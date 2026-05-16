import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ItemsService } from './items.service';
import { Item } from './item.entity';

const mockRepo = {
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation(d => d),
  save: jest.fn().mockImplementation(d => Promise.resolve({ id: 1, ...d })),
  delete: jest.fn().mockResolvedValue(undefined),
  findOneByOrFail: jest.fn().mockResolvedValue({ id: 1, name: 'widget' }),
};

describe('ItemsService', () => {
  let service: ItemsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ItemsService,
        { provide: getRepositoryToken(Item), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(ItemsService);
  });

  it('findAll returns array', async () => {
    expect(await service.findAll()).toEqual([]);
  });

  it('create returns item', async () => {
    const item = await service.create({ name: 'widget' });
    expect(item.name).toBe('widget');
  });
});
