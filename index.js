require('dotenv').config()

const TelegramBot = require('node-telegram-bot-api');

const {BOT_API_TOKEN: token} = process.env

const bot = new TelegramBot(token, {polling: true});

const enumCommand = {
    START: '/start',
    LUNCH: '/lunch',
    INFO: '/info'
}


bot.setMyCommands([
    {command: enumCommand.START, description: 'Начало работы с ботом'},
    {command: enumCommand.INFO, description: 'Информация о возможностях бота'},
    {command: enumCommand.LUNCH, description: 'Найти компанию для обеда'}
])

const startOptions = {
    reply_markup: JSON.stringify({
        inline_keyboard: [
            [{text: 'Не хочу обедать в одиночку', callback_data: '/lunch'}],
            [{text: 'Инфо о боте', callback_data: '/info'}]
        ]
    })
}

const commandHandler =  async (chatId, command) => {
    if (command === enumCommand.START) {
        await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/711/2ce/7112ce51-3cc1-42ca-8de7-62e7525dc332/2.webp')
        return bot.sendMessage(chatId, 'Привет, выбери, что ты хочешь!', startOptions)
    }

    if (command === enumCommand.INFO) {

        const htmlResponse = 'Добро пожаловать в бота LunchBuddy! Он поможет вам объединиться с коллегами для приятного обеда и общения. Забудьте о скучных обедах в одиночестве - с LunchBuddy вы всегда найдете компанию, чтобы насладиться вкусным и разнообразным обедом в приятной атмосфере. Давайте сделаем ваш рабочий обед ярче и интереснее с помощью LunchBuddy!\n\nПо всем вопросам/пожеланиям писать @dem1dov1van'

        return bot.sendMessage(chatId, htmlResponse, {parse_mode: "HTML"})
    }

    if (command === enumCommand.LUNCH) {
        return bot.sendMessage(chatId, 'Я тебя запомнил! Как только найдется для тебя пара - я дам знать')   
    }

    return bot.sendMessage(chatId, 'Я тебя не понимаю, попробуй еще раз!')
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    await commandHandler(chatId, msg.text)
});

bot.on('callback_query', async (msg) => {
    const chatId = msg.message.chat.id

    await commandHandler(chatId, msg.data)
})
