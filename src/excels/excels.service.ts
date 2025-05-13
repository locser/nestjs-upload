import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ExcelsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async exportAllDatabaseToExcel(table: string, limit: number) {
    const result = await this.getRowsInTable(table, limit);
    return result;
  }

  async getRowsInTable(table: string, limit: number) {
    console.log('getRowsInTable');
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      const result = await queryRunner.query(
        `SELECT * FROM ${table} LIMIT ${limit}`,
      );
      return result;
    } catch (error) {
      console.error('Error getting rows:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getColumnsInTable(table: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();

      // First get the current database name
      const dbResult = await queryRunner.query('SELECT DATABASE() as dbName');
      const dbName = dbResult[0].dbName;

      const result = await queryRunner.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = ?
         AND TABLE_SCHEMA = ?`,
        [table, dbName],
      );

      return result.map((column) => column.COLUMN_NAME);
    } catch (error) {
      console.error('Error getting columns:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getRowsInTableWithPagination(
    table: string,
    limit: number,
    offset: number,
  ): Promise<any[]> {
    const query = `SELECT * FROM ${table} LIMIT ? OFFSET ?`;
    return await this.dataSource.query(query, [limit, offset]);
  }
}
