import { Telegraf } from "telegraf";
import ExcelJS, { Workbook, Worksheet, CellValue } from "exceljs";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import * as fs from "fs";
import { Message } from "telegraf/typings/core/types/typegram";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const fileName = "table.xlsx";

// Конфигурация для ChartJSNodeCanvas
const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// Хранилище таблиц
const excelFiles: { [chatId: number]: string } = {};

bot.command("create", async (ctx) => {
  // Проверяем, существует ли файл
  if (fs.existsSync(fileName)) {
    await ctx.reply("Таблица уже существует.");
    return;
  }

  // Создаем новый файл Excel и добавляем лист с заголовками
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet 1");

  worksheet.columns = [
    { header: "Label", key: "label", width: 20 },
    { header: "Value", key: "value", width: 10 },
  ];

  await workbook.xlsx.writeFile(fileName);
  await ctx.reply("Таблица успешно создана.");
});

bot.command("add", async (ctx) => {
  // Проверка: существует ли файл таблицы
  if (!fs.existsSync(fileName)) {
    await ctx.reply(
      "Таблица не найдена. Сначала создайте ее с помощью команды /create."
    );
    return;
  }

  // Получение данных для добавления
  const messageText = ctx.message?.text;
  const input = messageText?.split(" ").slice(1); // Пример: /add label value
  if (!input || input.length < 2) {
    await ctx.reply(
      "Пожалуйста, укажите данные для добавления в формате: /add label value"
    );
    return;
  }

  const [label, value] = input;

  try {
    // Открываем существующий файл Excel
    const workbook = new ExcelJS.Workbook();
    console.log(`Открываем файл ${fileName} для добавления данных`);
    await workbook.xlsx.readFile(fileName);
    const worksheet = workbook.getWorksheet("Sheet 1");

    if (!worksheet) {
      await ctx.reply("Ошибка: лист не найден.");
      return;
    }

    // Добавляем новую строку с данными
    worksheet.addRow([label, parseFloat(value)]);

    // Сохраняем файл
    console.log(`Сохраняем изменения в файл ${fileName}`);
    await workbook.xlsx.writeFile(fileName);
    console.log(`Файл ${fileName} успешно обновлен`);

    await ctx.reply(`Добавлена новая запись: ${label} - ${value}`);
  } catch (error) {
    console.error("Ошибка при добавлении записи:", error);
    await ctx.reply("Произошла ошибка при добавлении записи.");
  }
});

bot.command("read", async (ctx) => {
  if (!fileName) {
    await ctx.reply("Создайте таблицу командой /create.");
    return;
  }

  const workbook: Workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(fileName);
  const worksheet = workbook.getWorksheet("Sheet 1");
  let result = "Данные из таблицы:\n";

  worksheet.eachRow((row, rowNumber) => {
    const rowValues = Array.isArray(row.values)
      ? row.values.map((value: CellValue) =>
          value !== null ? String(value) : ""
        )
      : [];

    result += `${rowNumber}: ${rowValues.join(", ")}\n`;
  });

  await ctx.reply(result);
});

// Команда для генерации графика
bot.command("chart", async (ctx) => {
  try {
    if (!fileName) {
      await ctx.reply("Создайте таблицу командой /create.");
      return;
    }

    const workbook: Workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(fileName);
    const worksheet = workbook.getWorksheet("Sheet 1");

    const labels: string[] = [];
    const values: number[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Пропускаем заголовки
        labels.push(String(row.getCell(1).value));
        values.push(Number(row.getCell(2).value));
      }
    });

    const configuration = {
      type: "line" as const,
      data: {
        labels,
        datasets: [
          {
            label: "Values",
            data: values,
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 2,
            fill: false,
          },
        ],
      },
    };

    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    await ctx.replyWithPhoto({ source: imageBuffer });
  } catch (error) {
    console.error("Ошибка при генерации графика:", error);
    await ctx.reply("Произошла ошибка при генерации графика.");
  }
});

bot.launch().then(() => console.log("Bot is running!"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
