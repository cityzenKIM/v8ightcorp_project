import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Users } from 'src/entities/Users';
import { JwtPayload } from './jwt/jwt-payload.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Users)
    private userRepository: Repository<Users>,
    private jwtService: JwtService,
  ) {}
  private readonly logger = new Logger('AuthSeviceLogger');

  async validateUser(email: string, password: string): Promise<Users> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'nickname', 'role', 'email', 'password'],
    });

    if (!user) {
      throw new NotFoundException('아이디를 확인해주세요.');
    }

    const isPasswordValidated = await bcrypt.compare(password, user.password);

    if (!isPasswordValidated) {
      throw new BadRequestException('아이디와 비밀번호를 확인해주세요.');
    }

    return user;
  }
  async tokenValidateUser(payload: JwtPayload) {
    return await this.userRepository.findOne({ where: { id: payload.id } });
  }
  async generateTokens(user: Users) {
    const payload = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    };
    try {
      const accessToken = await this.jwtService.sign(payload);
      const refreshToken = await this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRATION_TIME,
      });
      return { accessToken, refreshToken };
    } catch (error) {
      throw new UnauthorizedException(`로그인 실패 error: ${error}`);
    }
  }

  async refreshToken(token: string) {
    try {
      const payload = await this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const newPayload = {
        id: payload.id,
        email: payload.email,
        nickname: payload.nickname,
      };
      return {
        accessToken: await this.jwtService.sign(newPayload),
        refreshToken: await this.jwtService.sign(newPayload, {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: process.env.JWT_REFRESH_EXPIRATION_TIME,
        }),
      };
    } catch (error) {
      throw new UnauthorizedException(
        '토큰이 유효하지 않거나, 만료된 토큰입니다.',
      );
    }
  }
}
