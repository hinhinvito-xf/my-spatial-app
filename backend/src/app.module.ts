import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpaceGateway } from './space/space.gateway';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'admin',
      password: 'root',
      database: 'spatial_db',
      entities: [], // We will add entities here later
      synchronize: true, // Auto-creates tables (only for development!)
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SpaceGateway],
})
export class AppModule {}