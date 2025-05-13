import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Row, Workbook, Worksheet } from 'exceljs';
import { Response } from 'express';
import { ExcelsService } from './excels.service';
import * as fs from 'fs';
import { Transform } from 'stream';
import { createReadStream, createWriteStream } from 'fs';

@Controller('excels')
export class ExcelsController {
  constructor(private readonly excelsService: ExcelsService) {}

  // now i want create a endpoint to export all database to excel file.
  /**
   * @description Export all database to excel file
   * database mysql too large and optimize it
   * i want to export all database to excel file, return name of file, and file.
   * @param {string} table - The table to export
   * @returns {Promise<string>} The path to the excel file
   */
  @Get('export')
  async exportAllDatabaseToExcel(
    @Query('table') table: string,
  ): Promise<string> {
    const result = await this.excelsService.exportAllDatabaseToExcel(
      table,
      100,
    );
    return result;
  }

  @Get('xlsx/1')
  async exportXLSX(
    @Res() res: Response,
    @Query('table') table: string,
    @Query('file_name') file_name: string,
    @Query('limit') limit: number,
  ) {
    console.log('Bắt đầu xuất Excel:', { table, file_name, limit });

    try {
      // Kiểm tra tham số đầu vào
      const columns = await this.validateParams(table, file_name);

      const time1 = new Date().valueOf();
      const rows = await this.excelsService.getRowsInTable(table, +limit);

      const time2 = new Date().valueOf();
      console.log('time2 - time1', time2 - time1);

      if (!rows.length) {
        return res.status(200).json({
          success: false,
          message: 'Không có dữ liệu trong bảng',
        });
      }

      // Tạo workbook và worksheet
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(`${table}_export`);

      // Thiết lập các cột với style
      worksheet.columns = columns.map((columnName) => ({
        header: columnName,
        key: columnName,
        width: 20, // Độ rộng cột mặc định
        style: {
          font: { bold: true }, // Style cho header
          alignment: { vertical: 'middle', horizontal: 'center' },
        },
        useStyles: false, // Tắt styles nếu không cần thiết
        useSharedStrings: true, // Optimize cho text data
        zip: {
          compression: 'DEFLATE', // Nén file
        },
      }));

      // Add all rows from the database
      // rows.forEach((row) => {
      //   /**
      //    *  time2 - time1 1298
      //       Exported to excel file 222222222222222222 time3 - time1 34434
      //       GET /excels/xlsx?table=customers&file_name=xxxxls&limit=500000 200 34499ms
      //    */
      //   worksheet.addRow(row);
      // });
      rows.map((row) => {
        worksheet.addRow(row);
      });
      // Tạo buffer và gửi file
      const buffer = await workbook.xlsx.writeBuffer();

      // i want it add 1 time 1000 row
      // for (let i = 0; i < rows.length; i += 1000) {
      //   worksheet.addRows(rows.slice(i, i + 1000));
      // }

      // const buffer = await workbook.xlsx.writeBuffer({
      //   stream: {
      //     xlsx: {
      //       defaultColumnWidth: 10,
      //     },
      //   },
      // });
      // workbook.xlsx.writeBuffer();

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${encodeURIComponent(file_name)}.xlsx`,
        'Content-Length': buffer.byteLength,
      });

      // res.header(
      //   'Content-Disposition',
      //   `attachment; filename=${file_name}.xlsx`,
      // );

      // res.type(
      //   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // );
      res.send(buffer);
      const time3 = new Date().valueOf();
      console.log(
        'Exported to excel file 222222222222222222',
        'time3 - time1',
        time3 - time1,
      );
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      return res.status(200).json({
        success: false,
        message: 'Có lỗi xảy ra khi xuất Excel',
        error: error.message,
      });
    }
  }

  async validateParams(table: string, file_name: string): Promise<string[]> {
    // Kiểm tra tham số đầu vào
    if (!table || !file_name) {
      throw new HttpException(
        'Thiếu tham số table hoặc file_name',
        HttpStatus.BAD_REQUEST,
      );
    }

    const columns = await this.excelsService.getColumnsInTable(table);

    if (!columns.length) {
      throw new HttpException(
        'Không tìm thấy bảng hoặc bảng không có cột nào',
        HttpStatus.NOT_FOUND,
      );
    }

    return columns;
  }

  @Get('xlsx/2')
  async exportXLSX2(
    @Res() res: Response,
    @Query('table') table: string,
    @Query('file_name') file_name: string,
    @Query('limit') limit: number,
  ) {
    console.log('Bắt đầu xuất Excel:', { table, file_name, limit });

    const columns = await this.validateParams(table, file_name);

    try {
      const time1 = new Date().valueOf();
      const rows = await this.excelsService.getRowsInTable(table, +limit);

      const time2 = new Date().valueOf();
      console.log('time2 - time1', time2 - time1);

      if (!rows.length) {
        return res.status(200).json({
          success: false,
          message: 'Không có dữ liệu trong bảng',
        });
      }

      // Tạo workbook và worksheet
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(`${table}_export`);

      // Thiết lập các cột với style
      worksheet.columns = columns.map((columnName) => ({
        header: columnName,
        key: columnName,
        width: 20, // Độ rộng cột mặc định
        style: {
          font: { bold: true }, // Style cho header
          alignment: { vertical: 'middle', horizontal: 'center' },
        },
      }));

      // Add all rows from the database
      // rows.forEach((row) => {
      //   /**
      //    *  time2 - time1 1298
      //       Exported to excel file 222222222222222222 time3 - time1 34434
      //       GET /excels/xlsx?table=customers&file_name=xxxxls&limit=500000 200 34499ms
      //    */
      //   worksheet.addRow(row);
      // });

      // i want it add 1 time 1000 row
      for (let i = 0; i < rows.length; i += 1000) {
        worksheet.addRows(rows.slice(i, i + 1000));
      }

      const buffer = await workbook.xlsx.writeBuffer();
      workbook.xlsx.writeBuffer();

      res.header(
        'Content-Disposition',
        `attachment; filename=${file_name}.xlsx`,
      );

      res.type(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.send(buffer);
      const time3 = new Date().valueOf();
      console.log(
        'Exported to excel file 222222222222222222',
        'time3 - time1',
        time3 - time1,
      );
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      return res.status(200).json({
        success: false,
        message: 'Có lỗi xảy ra khi xuất Excel',
        error: error.message,
      });
    }
  }

  @Get('xlsx/3')
  async exportXLSX3(
    @Res() res: Response,
    @Query('table') table: string,
    @Query('file_name') file_name: string,
    @Query('limit') limit: number,
  ) {
    console.log('Bắt đầu xuất Excel:', { table, file_name, limit });

    const columns = await this.validateParams(table, file_name);

    try {
      const time1 = new Date().valueOf();
      const rows = await this.excelsService.getRowsInTable(table, +limit);

      const time2 = new Date().valueOf();
      console.log('time2 - time1', time2 - time1);

      if (!rows.length) {
        return res.status(200).json({
          success: false,
          message: 'Không có dữ liệu trong bảng',
        });
      }

      // Tạo workbook và worksheet
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(`${table}_export`);

      // Thiết lập các cột với style
      worksheet.columns = columns.map((columnName) => ({
        header: columnName,
        key: columnName,
        width: 20, // Độ rộng cột mặc định
        style: {
          font: { bold: true }, // Style cho header
          alignment: { vertical: 'middle', horizontal: 'center' },
        },
      }));

      // i want it add 1 time 1000 row
      for (let i = 0; i < rows.length; i += 1000) {
        worksheet.addRows(rows.slice(i, i + 1000));
      }

      // create a file path
      const filePath = `uploads/${Date.now().valueOf()}_${file_name}.xlsx`;

      const buffer = await workbook.xlsx.writeFile(filePath);

      workbook.xlsx.writeBuffer();

      // res.header(
      //   'Content-Disposition',
      //   `attachment; filename=${file_name}.xlsx`,
      // );

      // res.type(
      //   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // );
      // res.send(buffer);

      //useSharedStrings

      const time3 = new Date().valueOf();
      console.log(
        'Exported to excel file 222222222222222222',
        'time3 - time1',
        time3 - time1,
      );

      return res.status(200).json({
        success: true,
        message: 'Xuất Excel thành công',
        filePath,
      });
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      return res.status(200).json({
        success: false,
        message: 'Có lỗi xảy ra khi xuất Excel',
        error: error.message,
      });
    }
  }

  @Get('xlsx/4') // stream
  async exportXLSXStream(
    @Res() res: Response,
    @Query('table') table: string,
    @Query('file_name') file_name: string,
    @Query('limit') limit: number,
  ) {
    try {
      const columns = await this.validateParams(table, file_name);

      // Thiết lập response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${encodeURIComponent(file_name)}.xlsx`,
      );

      // Tạo workbook và worksheet
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(`${table}_export`);

      // Thiết lập các cột
      worksheet.columns = columns.map((columnName) => ({
        header: columnName,
        key: columnName,
        width: 20,
        style: {
          font: { bold: true },
          alignment: { vertical: 'middle', horizontal: 'center' },
        },
      }));

      // Kích thước của mỗi batch
      const batchSize = 1000;
      let offset = 0;

      // Hàm lấy và xử lý dữ liệu theo batch
      const processNextBatch = async () => {
        const batchRows = await this.excelsService.getRowsInTableWithPagination(
          table,
          batchSize,
          offset,
        );

        if (batchRows.length === 0) {
          return false;
        }

        worksheet.addRows(batchRows);
        offset += batchSize;
        return true;
      };

      // Xử lý từng batch cho đến khi hết dữ liệu
      let hasMoreData = true;
      while (hasMoreData && offset < limit) {
        hasMoreData = await processNextBatch();
      }

      // Stream kết quả về client
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi xuất Excel',
        error: error.message,
      });
    }
  }

  // @Get('xlsx/optimized')
  // async exportXLSXOptimized(
  //   @Res() res: Response,
  //   @Query('table') table: string,
  //   @Query('file_name') file_name: string,
  // ) {
  //   try {
  //     const columns = await this.validateParams(table, file_name);

  //     // Set headers
  //     res.setHeader(
  //       'Content-Type',
  //       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  //     );
  //     res.setHeader(
  //       'Content-Disposition',
  //       `attachment; filename=${encodeURIComponent(file_name)}.xlsx`
  //     );

  //     const workbook = new Workbook();
  //     const worksheet = workbook.addWorksheet(`${table}_export`);

  //     // Set up columns
  //     worksheet.columns = columns.map((columnName) => ({
  //       header: columnName,
  //       key: columnName,
  //       width: 20,
  //     }));

  //     // Tạo transform stream để xử lý dữ liệu
  //     const transformStream = new Transform({
  //       objectMode: true,
  //       transform(chunk, encoding, callback) {
  //         worksheet.addRow(chunk);
  //         callback();
  //       }
  //     });

  //     // Pipe database cursor to transform stream
  //     const dbStream = await this.excelsService.(table);
  //     dbStream.pipe(transformStream);

  //     // Write to response stream
  //     await new Promise((resolve, reject) => {
  //       transformStream.on('finish', async () => {
  //         try {
  //           await workbook.xlsx.write(res);
  //           res.end();
  //           resolve(true);
  //         } catch (err) {
  //           reject(err);
  //         }
  //       });
  //       transformStream.on('error', reject);
  //     });

  //   } catch (error) {
  //     console.error('Error exporting Excel:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Error exporting Excel',
  //       error: error.message,
  //     });
  //   }
  // }

  //Xử lý Chunks theo Worker
  /**
   * 1. get data
   * 2. create a path file
   * 3. create stream to write all chunks of file slice
   * 4. sync write file to path and return path immediately
   */
  @Get('xlsx/5')
  async exportXLSX5(
    @Res() res: Response,
    @Query('table') table: string,
    @Query('file_name') file_name: string,
    @Query('limit') limit: number,
  ) {
    try {
      const columns = await this.validateParams(table, file_name);

      const time1 = new Date().valueOf();
      const rows = await this.excelsService.getRowsInTable(table, +limit);

      const time2 = new Date().valueOf();
      console.log('time2 - time1', time2 - time1);

      if (!rows.length) {
        return res.status(200).json({
          success: false,
          message: 'Không có dữ liệu trong bảng',
        });
      }

      // create a path file
      const filePath = `uploads/${Date.now().valueOf()}_${file_name}.xlsx`;

      // create stream to write all chunks of file slice
      const stream = createWriteStream(filePath);

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(`${table}_export`);

      // set up columns
      worksheet.columns = columns.map((columnName) => ({
        header: columnName,
        key: columnName,
        width: 20,
      }));

      // add all rows from the database
      rows.forEach((row) => {
        worksheet.addRow(row);
      });

      // sync write file to path and return path immediately
      await workbook.xlsx.write(stream);

      return res.status(200).json({
        success: true,
        message: 'Xuất Excel thành công',
        filePath,
      });
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      return res.status(200).json({
        success: false,
        message: 'Có lỗi xảy ra khi xuất Excel',
        error: error.message,
      });
    }
  }

  @Get('xlsx/stream-chunks')
  async exportXLSXStreamChunks(
    @Res() res: Response,
    @Query('table') table: string,
    @Query('file_name') file_name: string,
    @Query('limit') limit: number,
  ) {
    try {
      const columns = await this.validateParams(table, file_name);
      const filePath = `uploads/${Date.now().valueOf()}_${file_name}.xlsx`;

      // Create write stream
      const writeStream = createWriteStream(filePath);

      // Create workbook with optimized options
      const workbook = new Workbook();

      const worksheet = workbook.addWorksheet(`${table}_export`);

      // Set up columns
      worksheet.columns = columns.map((columnName) => ({
        header: columnName,
        key: columnName,
        width: 20,
      }));

      // Process data in chunks

      // Get data chunk
      const rows = await this.excelsService.getRowsInTable(table, +limit);

      // get time for addRows
      worksheet.addRows(rows);

      const timestamp = Date.now().valueOf();
      const folderName = `uploads/${timestamp}_${file_name}`;
      const time1 = new Date().valueOf();
      console.log('time1', time1);

      const buffer = await workbook.xlsx.writeBuffer();
      // Xử lý chia chunks và ghi file trong background
      (() => {
        try {
          // Tạo buffer từ workbook

          // tajo folder
          fs.mkdirSync(folderName, { recursive: true });
          // Kích thước mỗi chunk (2MB)
          const chunkSize = 1 * 1024 * 1024; // 2MB in bytes
          const totalChunks = Math.ceil(buffer.byteLength / chunkSize);

          // Chia và ghi từng chunk
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, buffer.byteLength);
            const chunk = buffer.slice(start, end);

            // Tạo tên file chunk theo số thứ tự
            const chunkFileName = `${folderName}/${i + 1}`;

            // Ghi chunk vào file
            fs.writeFileSync(chunkFileName, Buffer.from(chunk));

            console.log(`Written chunk ${i + 1}/${totalChunks}`);
          }

          console.log(`Completed writing ${totalChunks} chunks`);
        } catch (error) {
          console.error('Error writing chunks:', error);
          // Cleanup nếu có lỗi
          if (fs.existsSync(folderName)) {
            fs.rmSync(folderName, { recursive: true, force: true });
          }
        }
      })();

      const time2 = new Date().valueOf();
      console.log('time2 - time1', time2 - time1);

      // Trả về response ngay lập tức
      return res.status(200).json({
        success: true,
        message: 'Đang xử lý export Excel',
        folderPath: folderName,
        downloadUrl: `/excels/download-chunks/${timestamp}_${file_name}`,
        status: 'processing',
      });
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      // Cleanup if error occurs

      return res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi xuất Excel',
        error: error.message,
      });
    }
  }

  // Endpoint để download file
  @Get('download/:fileName')
  async downloadFile(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const filePath = `uploads/${fileName}`;

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(202).json({
          success: false,
          message: 'File đang được tạo, vui lòng thử lại sau',
        });
      }

      // Stream file to client
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${encodeURIComponent(fileName)}`,
      );

      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Lỗi khi download file:', error);
      return res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi download file',
        error: error.message,
      });
    }
  }
}
