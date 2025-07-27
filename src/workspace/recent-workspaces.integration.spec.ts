import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { MembershipService } from './membership.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';

describe('Recent Workspaces Integration', () => {
  let service: WorkspaceService;
  let prisma: PrismaService;
  let membershipService: MembershipService;

  const mockUser: JwtPayload = {
    sub: 'test-user-123',
    email: 'test@example.com',
    role: 2, // USER role
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: PrismaService,
          useValue: {
            workspace: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: MembershipService,
          useValue: {
            getWorkspaceMemberCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
    prisma = module.get<PrismaService>(PrismaService);
    membershipService = module.get<MembershipService>(MembershipService);
  });

  describe('getRecentWorkspaces integration', () => {
    it('should handle complex sorting scenarios', async () => {
      const mockWorkspaces = [
        {
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
                createdAt: new Date('2024-01-15'), // Recent document
              },
            },
          ],
        },
        {
          id: 'workspace-2',
          name: 'Workspace 2',
          ownerId: 'owner-2',
          ownerType: 1,
          creatorId: 'creator-2',
          createdAt: new Date('2024-01-10'), // Recent creation, no documents
          updatedAt: new Date('2024-01-10'),
          _count: { members: 2 },
          documents: [],
        },
        {
          id: 'workspace-3',
          name: 'Workspace 3',
          ownerId: 'owner-3',
          ownerType: 0,
          creatorId: 'creator-3',
          createdAt: new Date('2024-01-05'), // Old creation, no documents
          updatedAt: new Date('2024-01-05'),
          _count: { members: 1 },
          documents: [],
        },
        {
          id: 'workspace-4',
          name: 'Workspace 4',
          ownerId: 'owner-4',
          ownerType: 0,
          creatorId: 'creator-4',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { members: 4 },
          documents: [
            {
              document: {
                createdAt: new Date('2024-01-20'), // Most recent document
              },
            },
          ],
        },
      ];

      (prisma.workspace.findMany as jest.Mock).mockResolvedValue(mockWorkspaces);

      const result = await service.getRecentWorkspaces(mockUser);

      // Verify sorting: workspace-4 (most recent doc), workspace-1 (older doc),
      // workspace-2 (recent creation), workspace-3 (old creation)
      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('workspace-4'); // Most recent document activity
      expect(result[1].id).toBe('workspace-1'); // Second most recent document activity
      expect(result[2].id).toBe('workspace-2'); // More recent creation date
      expect(result[3].id).toBe('workspace-3'); // Oldest creation date

      // Verify the query was called with correct parameters
      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
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

    it('should handle workspaces with same activity timestamp using ID tiebreaker', async () => {
      const sameTimestamp = new Date('2024-01-15');
      const mockWorkspaces = [
        {
          id: 'workspace-z',
          name: 'Workspace Z',
          ownerId: 'owner-1',
          ownerType: 0,
          creatorId: 'creator-1',
          createdAt: sameTimestamp,
          updatedAt: sameTimestamp,
          _count: { members: 1 },
          documents: [],
        },
        {
          id: 'workspace-a',
          name: 'Workspace A',
          ownerId: 'owner-2',
          ownerType: 0,
          creatorId: 'creator-2',
          createdAt: sameTimestamp,
          updatedAt: sameTimestamp,
          _count: { members: 1 },
          documents: [],
        },
      ];

      (prisma.workspace.findMany as jest.Mock).mockResolvedValue(mockWorkspaces);

      const result = await service.getRecentWorkspaces(mockUser);

      // Should be sorted alphabetically by ID when timestamps are the same
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('workspace-a');
      expect(result[1].id).toBe('workspace-z');
    });

    it('should enforce 6 workspace limit', async () => {
      const mockWorkspaces = Array.from({ length: 10 }, (_, i) => ({
        id: `workspace-${i + 1}`,
        name: `Workspace ${i + 1}`,
        ownerId: `owner-${i + 1}`,
        ownerType: 0,
        creatorId: `creator-${i + 1}`,
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        updatedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        _count: { members: 1 },
        documents: [],
      }));

      (prisma.workspace.findMany as jest.Mock).mockResolvedValue(mockWorkspaces);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result).toHaveLength(6);
      // Should return the 6 most recent (by creation date since no documents)
      expect(result[0].id).toBe('workspace-10');
      expect(result[5].id).toBe('workspace-5');
    });

    it('should handle mixed document activity and creation dates correctly', async () => {
      const mockWorkspaces = [
        {
          id: 'old-with-recent-doc',
          name: 'Old Workspace with Recent Doc',
          ownerId: 'owner-1',
          ownerType: 0,
          creatorId: 'creator-1',
          createdAt: new Date('2024-01-01'), // Very old
          updatedAt: new Date('2024-01-01'),
          _count: { members: 1 },
          documents: [
            {
              document: {
                createdAt: new Date('2024-01-25'), // Very recent document
              },
            },
          ],
        },
        {
          id: 'recent-no-docs',
          name: 'Recent Workspace No Docs',
          ownerId: 'owner-2',
          ownerType: 0,
          creatorId: 'creator-2',
          createdAt: new Date('2024-01-20'), // Recent creation
          updatedAt: new Date('2024-01-20'),
          _count: { members: 1 },
          documents: [],
        },
        {
          id: 'medium-with-old-doc',
          name: 'Medium Workspace with Old Doc',
          ownerId: 'owner-3',
          ownerType: 0,
          creatorId: 'creator-3',
          createdAt: new Date('2024-01-10'), // Medium creation
          updatedAt: new Date('2024-01-10'),
          _count: { members: 1 },
          documents: [
            {
              document: {
                createdAt: new Date('2024-01-12'), // Old document
              },
            },
          ],
        },
      ];

      (prisma.workspace.findMany as jest.Mock).mockResolvedValue(mockWorkspaces);

      const result = await service.getRecentWorkspaces(mockUser);

      expect(result).toHaveLength(3);
      // Document activity should take precedence over creation date
      expect(result[0].id).toBe('old-with-recent-doc'); // Recent document wins (2024-01-25)
      expect(result[1].id).toBe('recent-no-docs'); // Recent creation date (2024-01-20) beats old document
      expect(result[2].id).toBe('medium-with-old-doc'); // Old document activity (2024-01-12)
    });
  });
});
