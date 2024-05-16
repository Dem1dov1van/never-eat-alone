require('dotenv').config()

const { PrismaClient } = require('@prisma/client');
const TelegramBot = require('node-telegram-bot-api');

const prisma = new PrismaClient()

const {BOT_API_TOKEN: token} = process.env

const bot = new TelegramBot(token, {polling: true});

const enumCommand = {
    START: '/start',
    LUNCH: '/lunch',
    INFO: '/info'
}
const enumLocation = {
    SPB: 'spb',
    MSK: 'msk'
}

const locationToName = {
    [enumLocation.SPB]: 'Санкт-Петербурге',
    [enumLocation.MSK]: 'Москве'
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

const locationOptions = {
    reply_markup: JSON.stringify({
        inline_keyboard: [
            [{text: 'Санкт-Петербург', callback_data: enumLocation.SPB}],
            [{text: 'Москва', callback_data: enumLocation.MSK}]
        ]
    })
}

const timeOptions = {
    reply_markup: JSON.stringify({
        inline_keyboard: [
            [{text: '11:30', callback_data: '11:30'}, {text: '12:00', callback_data: '12:00'}],
            [{text: '12:30', callback_data: '12:30'}, {text: '13:00', callback_data: '13:00'}],
        ]
    })
}

const objCollector = {}

const commandHandler =  async (chatId, command, options) => {
    const {username=''} = options
    if (command === enumCommand.START) {
        await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/711/2ce/7112ce51-3cc1-42ca-8de7-62e7525dc332/2.webp')
        return bot.sendMessage(chatId, 'Привет, выбери, что ты хочешь!', startOptions)
    }

    if (command === enumCommand.INFO) {

        const htmlResponse = 'Добро пожаловать в бота LunchBuddy! Он поможет вам объединиться с коллегами для приятного обеда и общения. Забудьте о скучных обедах в одиночестве - с LunchBuddy вы всегда найдете компанию, чтобы насладиться вкусным и разнообразным обедом в приятной атмосфере. Давайте сделаем ваш рабочий обед ярче и интереснее с помощью LunchBuddy!\n\nПо всем вопросам/пожеланиям писать @dem1dov1van'

        return bot.sendMessage(chatId, htmlResponse, {parse_mode: "HTML"})
    }

    if (command === enumCommand.LUNCH) {

        const isAvailableToAdd = await checkIsUserAvailableToAdd(chatId)

        if(isAvailableToAdd) {
            bot.sendMessage(chatId, 'Я тебя уже запомнил! Подожди, пока я найду тебе компанию!') 

            return
        }

        objCollector[chatId] = {
            time: '',
            location: '',
            telegramUsername: username,
            chatId,
            isMatched: false
        }
        
        console.log(objCollector[chatId])
        
        bot.sendMessage(chatId, 'Выбери локацию, в каком офисе ты находишься', locationOptions) 
        return
    }

    if (command === enumLocation.MSK || command === enumLocation.SPB) {
        // console.log(objCollector[username], 'from loc')
        console.log(objCollector)
        if(!objCollector[chatId]) {
            return console.log('chatId is not defind')
        }
         objCollector[chatId].location = command
        bot.sendMessage(chatId, 'Отлично, с местом определились, теперь выбери время в которое ты бы хотел начать?', timeOptions) 

        console.log(objCollector[chatId])
        return
    }

    if (command === '11:30' || command === '12:00' || command === '12:30' || command === '13:00') {

        if(!objCollector[chatId]) {
            return console.log('chatId is not defind')
        }

        objCollector[chatId].time = command

        const timeStr = objCollector[chatId].time
        const hours = +timeStr.split(':')[0]
        const minutes = +timeStr.split(':')[1]
        const timestamp = getTimestamp(hours, minutes)

        try {
            await prisma.user.create({
                data: {
                    id: objCollector[chatId].chatId,
                    location: objCollector[chatId].location,
                    time: timestamp,
                    telegramUsername: objCollector[chatId].telegramUsername,
                    isMatched: objCollector[chatId].isMatched
                }
            })
        } catch {
            bot.sendMessage(chatId, 'Произошла ошибка при добавлении в БД!')
        }

        bot.sendMessage(chatId, 'Я запомнил тебя! Когда найду для тебя пару - сразу вернусь с информацей!') 
        const amount = (await getAllUsers()).length
        bot.sendMessage(chatId, `В списке ожидания ${amount} голодных и одиноких коллег(и))`) 

        findPair(objCollector[chatId].location, timestamp)

        return
    }

    return bot.sendMessage(chatId, 'Я тебя не понимаю, попробуй еще раз!')
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    // console.log(msg, 'from onmessage');
    
    
    await commandHandler(chatId, msg.text, {username: msg.chat.username})
});

bot.on('callback_query', async (msg) => {
    const chatId = msg.message.chat.id
    // console.log(msg);

    // console.log(msg, 'from oncallback');
    await commandHandler(chatId, msg.data, {username: msg.message.chat.username})
})

function getTimestamp(hours, minutes) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    
    const timestamp = new Date(year, month, day, hours, minutes).getTime();
    return timestamp;
}

const checkIsUserAvailableToAdd = async (chatId) => {
    const user = await getUserById(chatId)
    return !!user
}

const findPair = (location, time) => {
    prisma.user.findMany({where: {
        isMatched: false,
        location,
        time
    }}).then(data => {
        if(data.length > 1) {
            data.forEach( async(user, i) => {
                anotherUser = data[i === 0 ? 1 : 0].telegramUsername
                await prisma.user.update({
                    where: {
                        id: user.id
                    },
                    data: {
                        isMatched: true
                    }
                })
                setTimeout(() => {
                    bot.sendMessage(user.id, `Ура! Я нашел тебе пару. И это: @${anotherUser}, ваш обед пройдет в ${locationToName[user.location]} в ${getHumanTime(user.time)}.\n\nНе опаздывай!`, {parse_mode: "HTML"}) 
                }, 5000) 
            })
            console.log('coвпадение найдено')
        } else {
            console.log('ждем пары')
        }
    })
}

const getHumanTime = (bigInt) => {
    const timestamp = `${bigInt}`.replace('n', '')

    const date = new Date(+timestamp);
    let hours = date.getHours();
    let minutes = date.getMinutes();

    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    return hours + ':' + minutes;
}

const getAllUsers = () => prisma.user.findMany()

const getUserById = (id) => prisma.user.findUnique({where: {id}})
