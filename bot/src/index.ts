import * as fs from "fs";

import { Telegraf, Markup } from "telegraf";
import ExcelJS, { Workbook, Worksheet, CellValue } from "exceljs";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { Message } from "telegraf/typings/core/types/typegram";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const FILE_NAME: string = 'table.xlsx';

// Конфигурация для ChartJSNodeCanvas
const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

const getMenuStage = async (ctx: any) => {
    await ctx.reply(
        "Выберите действие:",
        Markup.inlineKeyboard([
            [{ text: `Создать таблицу`, callback_data: "create", hide: false }],
            [{ text: `Добавить запись`, callback_data: "add", hide: false }],
            [{ text: `Прочитать данные`, callback_data: "read", hide: false }],
            [{ text: `Построить график`, callback_data: "chart", hide: false }],
        ])
    );
};

bot.start(async (ctx: any) => {
    await ctx.reply(`✨✨ ${ctx.chat.first_name}, добро пожаловать! ✨✨`);
    await getMenuStage(ctx);
});

// Хранилище таблиц
const excelFiles: { [chatId: number]: string } = {};

bot.action("create", async (ctx: any) => {
    try {
        // Проверяем, существует ли файл
        if (fs.existsSync(FILE_NAME)) {
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

        await workbook.xlsx.writeFile(FILE_NAME);
        await ctx.reply("Таблица успешно создана.");
    } catch (error) {
        console.error("Ошибка при создании таблицы:", error);
        await ctx.reply("Произошла ошибка при создании таблицы.");
    } finally {
        await getMenuStage(ctx);
    }
});

bot.action("add", async (ctx: any) => {
    // Проверка: существует ли файл таблицы
    if (!fs.existsSync(FILE_NAME)) {
        await ctx.reply(
            "Таблица не найдена. Сначала создайте ее с помощью команды /create."
        );
        return;
    }

    await ctx.reply(
        "Пожалуйста, укажите данные для добавления в формате: /add label value"
    );
    await getMenuStage(ctx);
});

bot.command("add", async (ctx: any) => {
    // Проверка: существует ли файл таблицы
    if (!fs.existsSync(FILE_NAME)) {
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

        console.log(`Открываем файл ${FILE_NAME} для добавления данных`);

        await workbook.xlsx.readFile(FILE_NAME);
        const worksheet = workbook.getWorksheet("Sheet 1");

        if (!worksheet) {
            await ctx.reply("Ошибка: лист не найден.");
            return;
        }

        // Добавляем новую строку с данными
        worksheet.addRow([label, parseFloat(value)]);

        // Сохраняем файл
        console.log(`Сохраняем изменения в файл ${FILE_NAME}`);
        await workbook.xlsx.writeFile(FILE_NAME);
        console.log(`Файл ${FILE_NAME} успешно обновлен`);

        await ctx.reply(`Добавлена новая запись: ${label} - ${value}`);
    } catch (error) {
        console.error("Ошибка при добавлении записи:", error);
        await ctx.reply("Произошла ошибка при добавлении записи.");
    } finally {
        await getMenuStage(ctx);
    }
});

bot.action("read", async (ctx: any) => {
    try {
        if (!FILE_NAME) {
            await ctx.reply("Создайте таблицу командой /create.");
            return;
        }

        const workbook: Workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(FILE_NAME);
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
    } catch (error) {
        console.error("Ошибка при чтении данных:", error);
        await ctx.reply("Произошла ошибка при чтении данных.");
    } finally {
        await getMenuStage(ctx);
    }
});

// Команда для генерации графика
bot.action("chart", async (ctx: any) => {
    try {
        if (!FILE_NAME) {
            await ctx.reply("Создайте таблицу командой /create.");
            return;
        }

        const workbook: Workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(FILE_NAME);
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

        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(
            configuration
        );
        await ctx.replyWithPhoto({ source: imageBuffer });
    } catch (error) {
        console.error("Ошибка при генерации графика:", error);
        await ctx.reply("Произошла ошибка при генерации графика.");
    } finally {
        await getMenuStage(ctx);
    }
});

bot.launch().then(() => console.log("Bot is running!"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
