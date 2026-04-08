export class HealthRepository {
  getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  }
}
