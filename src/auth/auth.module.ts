import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { PrismaService } from 'src/prisma/prisma.service';
import { JwtStrategy } from './guards/jwt.strategy';
import { SecurityModule } from 'src/security/security.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({defaultStrategy: 'jwt'}),
    JwtModule.register({}), 
    SecurityModule
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
