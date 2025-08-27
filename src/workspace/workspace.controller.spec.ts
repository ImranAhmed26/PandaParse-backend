import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { MembershipService } from './membership.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { WorkspaceCreateGuard } from 'src/auth/guards/workspaceCreate.guard';
import { WorkspaceAccessGuard } from 'src/auth/guards/workspace-access.guard';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
   
  let workspaceService: any;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let membershipService: any;

  const mockUser: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: 2, // USER role
  };

  const mockAdminUser: JwtPayload = {
    sub: 'admin-123',
    email: 'admin@example.com',
    role: 0, // ADMIN role
  };

  const mockWorkspaceResponse: WorkspaceResponseDto = {
    id: 'workspace-1',
    name: 'Test Workspace',
    ownerId: 'owner-1',
    ownerType: 0,
    creatorId: 'creator-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    memberCount: 3,
  };

  beforeEach(async () => {
    const mockWorkspaceService = {
      getRecentWorkspaces: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findUserWorkspaces: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      checkNameAvailability: jest.fn(),
    };

    const mockMembershipService = {
      getWorkspaceMembers: jest.fn(),
      addMembersToWorkspace: jest.fn(),
      removeMembersFromWorkspace: jest.fn(),
      getUserCompanyInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        {
          provide: WorkspaceService,
          useValue: mockWorkspaceService,
        },
        {
          provide: MembershipService,
          useValue: mockMembershipService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(WorkspaceCreateGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(WorkspaceAccessGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<WorkspaceController>(WorkspaceController);
     
    workspaceService = module.get(WorkspaceService);
     
    membershipService = module.get(MembershipService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRecentWorkspaces', () => {
     
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    it('should return recent workspaces for authenticated user', async () => {
      const mockRecentWorkspaces = [mockWorkspaceResponse];
      workspaceService.getRecentWorkspaces.mockResolvedValue(mockRecentWorkspaces);

      const result = await controller.getRecentWorkspaces(mockUser);

      expect(result).toEqual(mockRecentWorkspaces);
      expect(workspaceService.getRecentWorkspaces).toHaveBeenCalledWith(mockUser);
      expect(workspaceService.getRecentWorkspaces).toHaveBeenCalledTimes(1);
    });

    it('should return recent workspaces for admin user', async () => {
      const mockRecentWorkspaces = [mockWorkspaceResponse];
      workspaceService.getRecentWorkspaces.mockResolvedValue(mockRecentWorkspaces);

      const result = await controller.getRecentWorkspaces(mockAdminUser);

      expect(result).toEqual(mockRecentWorkspaces);
      expect(workspaceService.getRecentWorkspaces).toHaveBeenCalledWith(mockAdminUser);
    });

    it('should return empty array when user has no recent workspaces', async () => {
      workspaceService.getRecentWorkspaces.mockResolvedValue([]);

      const result = await controller.getRecentWorkspaces(mockUser);

      expect(result).toEqual([]);
      expect(workspaceService.getRecentWorkspaces).toHaveBeenCalledWith(mockUser);
    });

    it('should return exactly 6 workspaces when user has many workspaces', async () => {
      const mockManyWorkspaces = Array.from({ length: 6 }, (_, i) => ({
        ...mockWorkspaceResponse,
        id: `workspace-${i + 1}`,
        name: `Workspace ${i + 1}`,
      }));
      workspaceService.getRecentWorkspaces.mockResolvedValue(mockManyWorkspaces);

      const result = await controller.getRecentWorkspaces(mockUser);

      expect(result).toHaveLength(6);
      expect(workspaceService.getRecentWorkspaces).toHaveBeenCalledWith(mockUser);
    });

    it('should handle service errors and propagate them', async () => {
      const serviceError = new InternalServerErrorException('Failed to fetch recent workspaces');
      workspaceService.getRecentWorkspaces.mockRejectedValue(serviceError);

      await expect(controller.getRecentWorkspaces(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(workspaceService.getRecentWorkspaces).toHaveBeenCalledWith(mockUser);
    });

    it('should handle forbidden errors when user access is denied', async () => {
      const forbiddenError = new ForbiddenException('User not found');
      workspaceService.getRecentWorkspaces.mockRejectedValue(forbiddenError);

      await expect(controller.getRecentWorkspaces(mockUser)).rejects.toThrow(ForbiddenException);
      expect(workspaceService.getRecentWorkspaces).toHaveBeenCalledWith(mockUser);
    });

    it('should return workspaces with correct response format', async () => {
      const mockWorkspaces = [
        {
          id: 'workspace-1',
          name: 'Workspace 1',
          ownerId: 'owner-1',
          ownerType: 0,
          creatorId: 'creator-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          memberCount: 3,
        },
        {
          id: 'workspace-2',
          name: 'Workspace 2',
          ownerId: 'owner-2',
          ownerType: 1,
          creatorId: 'creator-2',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          memberCount: 5,
        },
      ];
      workspaceService.getRecentWorkspaces.mockResolvedValue(mockWorkspaces);

      const result = await controller.getRecentWorkspaces(mockUser);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('ownerId');
      expect(result[0]).toHaveProperty('ownerType');
      expect(result[0]).toHaveProperty('creatorId');
      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('updatedAt');
      expect(result[0]).toHaveProperty('memberCount');
      expect(result[0]).not.toHaveProperty('documents');
      expect(result[0]).not.toHaveProperty('members');
    });

    it('should validate that ownerType is numeric', async () => {
      const mockWorkspaces = [
        {
          ...mockWorkspaceResponse,
          ownerType: 0, // USER
        },
        {
          ...mockWorkspaceResponse,
          id: 'workspace-2',
          ownerType: 1, // COMPANY
        },
      ];
      workspaceService.getRecentWorkspaces.mockResolvedValue(mockWorkspaces);

      const result = await controller.getRecentWorkspaces(mockUser);

      expect(result[0].ownerType).toBe(0);
      expect(result[1].ownerType).toBe(1);
      expect(typeof result[0].ownerType).toBe('number');
      expect(typeof result[1].ownerType).toBe('number');
    });

    it('should ensure memberCount is included in response', async () => {
      const mockWorkspaces = [
        {
          ...mockWorkspaceResponse,
          memberCount: 5,
        },
      ];
      workspaceService.getRecentWorkspaces.mockResolvedValue(mockWorkspaces);

      const result = await controller.getRecentWorkspaces(mockUser);

      expect(result[0].memberCount).toBe(5);
      expect(typeof result[0].memberCount).toBe('number');
    });
     
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
  });
});
