import { Test, TestingModule } from '@nestjs/testing';
import { SpaceGateway } from './space.gateway';

describe('SpaceGateway', () => {
  let gateway: SpaceGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpaceGateway],
    }).compile();

    gateway = module.get<SpaceGateway>(SpaceGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
