import { HealthRepository } from '../repositories/health.repository';
import { monitoringService } from './monitoring.service';

export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  check() {
    return {
      ...this.healthRepository.getStatus(),
      monitoring: monitoringService.snapshot()
    };
  }
}
