Веб-приложение для совместной работы над документами

Функционал: Веб-редактор текста, предназначенный для совместной работы над документами. ии документа.

Стек технологий:

Frontend: JavaScript, React
Backend: Kotlin, Spring Framework
База данных: PostgreSQL
Развертывание: Docker

Локальное развёртывание:

1)Запустить Docker
2)Создать образ postgres с базой данных при помощи команды docker run --name textEditorDb -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=textEditorDb -p 5432:5432 -d postgres:14
3)Перейти в папку back-end, открыть с помощью IntellijIdea и запустить проект
3)Перейти в папку front-end, открыть там консоль и прописать npm start
