import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from './membership.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
   
  let prismaService: any;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let membershipService: any;

  const mockUser: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: 2, // USER role
  };

  const mockWorkspaceWithDocuments = {
    id: 'workspace-1',
    name: 'Workspace 1',
    ownerId: 'owner-1',
    ownerType: 0,
    creatorId: 'creator-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    _count: { members: 3 },
    documents: [
      {
        document: {
          createdAt: new Date('2024-01-15'),
        },
      },
    ],
  };

  const mockWorkspaceWithoutDocuments = {
    id: 'workspace-2',
    name: 'Workspace 2',
    ownerId: 'owner-2',
    ownerType: 1,
    creatorId: 'creator-2',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    _count: { members: 2 },
    documents: [],
  };

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mockPrismaService = {
      workspace: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      workspaceMember: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mockMembershipService = {
      getWorkspaceMemberCount: jest.fn(),
      validateMembershipEligibility: jest.fn(),
      getWorkspaceMembers: jest.fn(),
      addMembersToWorkspace: jest.fn(),
      removeMembersFromWorkspace: jest.fn(),
      getUserCompanyInfo: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: PrismaService,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          useValue: mockPrismaService,
        },
        {
          provide: MembershipService,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          useValue: mockMembershipService,
        },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    prismaService = module.get(PrismaService);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    membershipService = module.get(MembershipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRecentWorkspaces', () => {
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    it('should return 6 workspaces when user has more than 6 workspaces', async () => {
      // Create 8 mock workspaces
      const mockWorkspaces = Array.from({ length: 8 }, (_, i) => ({
        id: `workspace-${i + 1}`,
        name: `Workspace ${i + 1}`,
        ownerId: `owner-${i + 1}`,
        ownerType: 0,
        creatorId: `creator-${i + 1}`,
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        updatedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        _count: { members: 2 },
        documents: [
          {
            document: {
              createdAt: new Date(`2024-01-${String(i + 10).padStart(2, '0')}`),
            },
          },
        ],
      }));

      prismaService.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result).toHaveLength(6);
      expect(prismaService.workspace.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: mockUser.sub,
            },
          },
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          ownerType: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              members: true,
            },
          },
          documents: {
            select: {
              document: {
                select: {
                  createdAt: true,
                },
              },
            },
            orderBy: {
              document: {
                createdAt: 'desc',
              },
            },
            take: 1,
          },
        },
      });
    });

    it('should return all workspaces when user has fewer than 6 workspaces', async () => {
      const mockWorkspaces = [mockWorkspaceWithDocuments, mockWorkspaceWithoutDocuments];
      prismaService.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('workspace-1'); // Should be first due to recent document
      expect(result[1].id).toBe('workspace-2');
    });

    it('should return empty array when user has no accessible workspaces', async () => {
      prismaService.workspace.findMany.mockResolvedValue([]);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should sort workspaces by most recent document activity', async () => {
      const workspace1 = {
        ...mockWorkspaceWithDocuments,
        id: 'workspace-1',
        documents: [{ document: { createdAt: new Date('2024-01-20') } }],
      };
      const workspace2 = {
        ...mockWorkspaceWithDocuments,
        id: 'workspace-2',
        documents: [{ document: { createdAt: new Date('2024-01-25') } }],
      };
      const workspace3 = {
        ...mockWorkspaceWithDocuments,
        id: 'workspace-3',
        documents: [{ document: { createdAt: new Date('2024-01-15') } }],
      };

      prismaService.workspace.findMany.mockResolvedValue([workspace1, workspace2, workspace3]);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result[0].id).toBe('workspace-2'); // Most recent document (2024-01-25)
      expect(result[1].id).toBe('workspace-1'); // Second most recent (2024-01-20)
      expect(result[2].id).toBe('workspace-3'); // Oldest document (2024-01-15)
    });

    it('should fallback to workspace creation date for workspaces without documents', async () => {
      const workspaceWithDoc = {
        ...mockWorkspaceWithDocuments,
        id: 'workspace-with-doc',
        createdAt: new Date('2024-01-01'),
        documents: [{ document: { createdAt: new Date('2024-01-20') } }],
      };
      const workspaceWithoutDoc1 = {
        ...mockWorkspaceWithoutDocuments,
        id: 'workspace-no-doc-1',
        createdAt: new Date('2024-01-15'),
        documents: [],
      };
      const workspaceWithoutDoc2 = {
        ...mockWorkspaceWithoutDocuments,
        id: 'workspace-no-doc-2',
        createdAt: new Date('2024-01-10'),
        documents: [],
      };

      prismaService.workspace.findMany.mockResolvedValue([
        workspaceWithDoc,
        workspaceWithoutDoc1,
        workspaceWithoutDoc2,
      ]);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result[0].id).toBe('workspace-with-doc'); // Most recent activity (document)
      expect(result[1].id).toBe('workspace-no-doc-1'); // More recent creation date
      expect(result[2].id).toBe('workspace-no-doc-2'); // Older creation date
    });

    it('should use workspace ID as tiebreaker for consistent ordering', async () => {
      const workspace1 = {
        ...mockWorkspaceWithoutDocuments,
        id: 'workspace-b',
        createdAt: new Date('2024-01-15'),
        documents: [],
      };
      const workspace2 = {
        ...mockWorkspaceWithoutDocuments,
        id: 'workspace-a',
        createdAt: new Date('2024-01-15'), // Same creation date
        documents: [],
      };

      prismaService.workspace.findMany.mockResolvedValue([workspace1, workspace2]);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result[0].id).toBe('workspace-a'); // Should come first alphabetically
      expect(result[1].id).toBe('workspace-b');
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      prismaService.workspace.findMany.mockRejectedValue(dbError);

      await expect(service.getRecentWorkspaces(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getRecentWorkspaces(mockUser)).rejects.toThrow(
        'Failed to fetch recent workspaces',
      );
    });

    it('should include member count in response', async () => {
      const mockWorkspaces = [
        {
          ...mockWorkspaceWithDocuments,
          _count: { members: 5 },
        },
      ];
      prismaService.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result[0].memberCount).toBe(5);
    });

    it('should not include documents in final response', async () => {
      prismaService.workspace.findMany.mockResolvedValue([mockWorkspaceWithDocuments]);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result[0]).not.toHaveProperty('documents');
      expect(result[0]).not.toHaveProperty('activityTimestamp');
    });
    /* eslint-enable @typescript-eslint/no-unsafe-call */
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
  });
});
