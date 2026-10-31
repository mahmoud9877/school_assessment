import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtPayload } from './jwt-payload.interface.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { name, email, password, role } = registerDto;

    if (await this.users.existsByEmail(email)) {
      throw new ConflictException('Email already exists');
    }

    return this.users.create({
      name,
      email,
      role,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Same error for unknown email and wrong password, so the response does
    // not reveal which emails have accounts.
    const user = await this.users.findByEmailWithPassword(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const { password: _password, ...safeUser } = user;
    return {
      user: safeUser,
      accessToken: await this.jwtService.signAsync(payload),
    };
  }
}
