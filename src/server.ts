import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { assertDatabaseSchemaContract } from './services/database-contract.service';
import { startDashboardExportWorker } from './workers/dashboard-export.worker';
import { startReminderWorker } from './workers/reminder.worker';

const startServer = async () => {
  if (env.DATABASE_CONTRACT_CHECK_ENABLED) {
    await assertDatabaseSchemaContract();
    logger.info('database_contract_check_passed');
  } else {
    logger.warn('database_contract_check_disabled');
  }

  const server = app.listen(env.PORT, () => {
    logger.info('backend_server_started', {
      port: env.PORT,
      url: `http://localhost:${env.PORT}`
    });
  });

  const reminderWorker = startReminderWorker();
  const dashboardExportWorker = startDashboardExportWorker();
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info('backend_server_shutdown_requested');
    reminderWorker.stop();
    dashboardExportWorker.stop();
    server.close(() => {
      void prisma
        .$disconnect()
        .catch((error) => {
          logger.error('prisma_disconnect_failed', {
            error
          });
        })
        .finally(() => {
          logger.info('backend_server_stopped');
          process.exit(0);
        });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

void startServer().catch((error) => {
  logger.error('backend_server_start_failed', {
    error
  });
  void prisma
    .$disconnect()
    .catch(() => {})
    .finally(() => {
      process.exit(1);
    });
});
