import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';

@Injectable()
export class ItemsService {
  constructor(@InjectRepository(Item) private repo: Repository<Item>) {}

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneByOrFail({ id });
  }

  create(data: { name: string; description?: string }) {
    return this.repo.save(this.repo.create(data));
  }

  async remove(id: number) {
    await this.repo.delete(id);
  }
}
