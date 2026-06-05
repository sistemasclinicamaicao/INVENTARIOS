import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByCedula(cedula: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { cedula, isActive: true } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id, isActive: true } });
  }
}
