import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'mysql',
      host: '172.16.10.145',
      port: parseInt('3306'),
      username: 'ttl_customer_beta',
      password: 'ttl_customer_beta',
      database: 'ttl_customer_beta',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      timezone: '+07:00',
      dateStrings: true,
      multipleStatements: true,
      synchronize: false,
      logging: true,
      extra: {
        connectTimeout: +(
          process.env.CONFIG_MYSQL_CONNECTION_TIMEOUT_ACCOUNTING ?? 2000
        ),
        min: +(
          process.env.CONFIG_MYSQL_CONNECTION_POOL_MIN_IDLE_ACCOUNTING ?? 1
        ), // xử lý bao nhiêu session
        connectionLimit: +(
          process.env.CONFIG_MYSQL_CONNECTION_POOL_MAX_SIZE_ACCOUNTING ?? 1
        ), // giới hạn tối đa
        // idleTimeoutMillis: +(
        //   process.env.CONFIG_MYSQL_CONNECTION_POOL_IDLE_TIMEOUT_ACCOUNTING ??
        //   2000
        // ),
        waitForConnections: true, // Chờ nếu pool đã đạt giới hạn
      },
    };
  }
}
