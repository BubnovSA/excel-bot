// const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

import { Telegraf } from 'telegraf';
import ExcelJS, { Workbook, Worksheet } from 'exceljs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs';
import { Message } from 'telegraf/typings/core/types/typegram';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Конфигурация для ChartJSNodeCanvas
const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// Хранилище таблиц
const excelFiles: { [chatId: number]: string } = {};

// Команда для создания новой таблицы
bot.command('create', async (ctx) => {
  const workbook: Workbook = new ExcelJS.Workbook();
  const worksheet: Worksheet = workbook.addWorksheet('Sheet 1');
  worksheet.columns = [{ header: 'ID', key: 'id' }, { header: 'Value', key: 'value' }];
  const fileName = `table_${Date.now()}.xlsx`;
  await workbook.xlsx.writeFile(fileName);
  excelFiles[ctx.chat.id] = fileName;
  await ctx.reply('Создана новая таблица.');
});

// Команда для добавления данных в таблицу
bot.command('add', async (ctx) => {
  const data = ctx.message?.text.split(' ').slice(1);

  if (!data || data.length !== 2) {
    await ctx.reply('Используйте: /add <ID> <Value>');
    return;
  }

  const [id, value] = data;
  const fileName = excelFiles[ctx.chat.id];

  if (!fileName) {
    await ctx.reply('Создайте таблицу командой /create.');
    return;
  }

  const workbook: Workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(fileName);
  const worksheet = workbook.getWorksheet('Sheet 1');
  worksheet.addRow({ id, value });
  await workbook.xlsx.writeFile(fileName);
  await ctx.reply(`Данные добавлены: ID=${id}, Value=${value}`);
});

// bot.command('read', async (ctx) => {
//   const fileName = excelFiles[ctx.chat.id];
//   if (!fileName) {
//     await ctx.reply('Создайте таблицу командой /create.');
//     return;
//   }
//
//   const workbook: Workbook = new ExcelJS.Workbook();
//   await workbook.xlsx.readFile(fileName);
//   const worksheet = workbook.getWorksheet('Sheet 1');
//   let result = 'Данные из таблицы:\n';
//
//   worksheet.eachRow((row, rowNumber) => {
//     const rowValues = Array.isArray(row.values)
//       ? row.values.map((value: CellValue) => (value !== null ? String(value) : ''))
//       : [];
//       
//     result += `${rowNumber}: ${rowValues.join(', ')}\n`;
//   });
//
//   await ctx.reply(result);
// });

// Команда для генерации графика
bot.command('chart', async (ctx) => {
  try {
    const fileName = excelFiles[ctx.chat.id];
    if (!fileName) {
      await ctx.reply('Создайте таблицу командой /create.');
      return;
    }

    const workbook: Workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(fileName);
    const worksheet = workbook.getWorksheet('Sheet 1');

    const labels: string[] = [];
    const values: number[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {  // Пропускаем заголовки
        labels.push(String(row.getCell(1).value));
        values.push(Number(row.getCell(2).value));
      }
    });

    const configuration = {
      type: 'line' as const,
      data: {
        labels,
        datasets: [{
          label: 'Values',
          data: values,
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          fill: false
        }]
      }
    };

    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    await ctx.replyWithPhoto({ source: imageBuffer });
  } catch (error) {
    console.error('Ошибка при генерации графика:', error);
    await ctx.reply('Произошла ошибка при генерации графика.');
  }
});
// Запуск бота
bot.launch().then(() => console.log('Bot is running!'));

// Обработка завершения работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
