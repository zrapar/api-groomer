import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import { BusinessRepository } from '../repositories/business.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { UserRepository } from '../repositories/user.repository';
import { UserRole } from '../auth/dto/user-role.enum';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly staffRepo: StaffRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async list(ownerId: string) {
    const business = await this.getBusinessOrFail(ownerId);
    return this.staffRepo.findByBusinessId(business.id);
  }

  async create(ownerId: string, payload: CreateStaffDto) {
    const business = await this.getBusinessOrFail(ownerId);
    const normalizedEmail = payload.email.toLowerCase();

    let existingUser = await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser && existingUser.role !== UserRole.GROOMER_STAFF) {
      throw new BadRequestException('Email is already used by another role.');
    }

    if (!existingUser) {
      const passwordHash = await hash(
        payload.password ?? this.generateRandomPassword(),
        10,
      );
      existingUser = await this.userRepo.create({
        email: normalizedEmail,
        passwordHash,
        role: UserRole.GROOMER_STAFF,
      });
    }

    const existingMember = await this.staffRepo.findByBusinessAndUserId(
      business.id,
      existingUser.id,
    );
    if (existingMember)
      throw new BadRequestException('Staff member already exists.');

    return this.staffRepo.create(
      business.id,
      existingUser.id,
      payload.displayName,
    );
  }

  async update(ownerId: string, staffId: string, payload: UpdateStaffDto) {
    const business = await this.getBusinessOrFail(ownerId);
    const existing = await this.staffRepo.findById(staffId);
    if (!existing || existing.businessId !== business.id) {
      throw new NotFoundException('Staff member not found.');
    }
    return this.staffRepo.update(staffId, {
      displayName: payload.displayName,
      isActive: payload.isActive,
    });
  }

  async deactivate(ownerId: string, staffId: string) {
    return this.update(ownerId, staffId, { isActive: false });
  }

  async remove(ownerId: string, staffId: string) {
    const business = await this.getBusinessOrFail(ownerId);
    const existing = await this.staffRepo.findById(staffId);
    if (!existing || existing.businessId !== business.id) {
      throw new NotFoundException('Staff member not found.');
    }
    await this.staffRepo.delete(staffId);
    return { deleted: true };
  }

  private async getBusinessOrFail(ownerId: string) {
    const business = await this.businessRepo.findByOwnerId(ownerId);
    if (!business)
      throw new NotFoundException('Business not found for this owner.');
    return business;
  }

  private generateRandomPassword() {
    return Math.random().toString(36).slice(2) + 'A1!';
  }
}
