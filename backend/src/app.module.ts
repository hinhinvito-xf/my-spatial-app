import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpaceGateway } from './space/space.gateway'; 

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      // FIX 1: Use the Environment Variable provided by Railway
      url: process.env.DATABASE_URL || 'postgres://admin:root@localhost:5432/spatial_db', 
      
      autoLoadEntities: true,
      synchronize: true,
      
      // FIX 2: Railway requires SSL (Secure connection)
      // We enable it only if we are using the cloud URL
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SpaceGateway],
})
export class AppModule {}
