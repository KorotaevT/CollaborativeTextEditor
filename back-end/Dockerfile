FROM gradle:8.8-jdk17 as build
WORKDIR /app

# Копируем Gradle Wrapper файлы
COPY gradlew .
COPY gradle/ gradle/
COPY build.gradle.kts .

RUN chmod +x gradlew

# Устанавливаем dos2unix
RUN apt-get update && apt-get install -y dos2unix

# Преобразуем конец строки в файлах Gradle
RUN dos2unix gradlew gradle/wrapper/gradle-wrapper.properties build.gradle.kts

# Проверка наличия необходимых файлов
RUN ls -la
RUN ls -la gradle/wrapper

# Установка переменной окружения для TLS
ENV JAVA_OPTS="-Dhttps.protocols=TLSv1.2,TLSv1.3"

# Установка зависимостей
RUN ./gradlew dependencies --configuration runtimeClasspath

# Копирование исходного кода
COPY src src

# Сборка проекта
RUN ./gradlew clean build -x test --info --stacktrace

RUN echo "Содержимое /app после сборки:" && ls -R /app

# Проверка содержимого директории build/libs после сборки
RUN echo "Содержимое build/libs:"
RUN ls -la build/libs/

# Проверка текущей директории и содержимого
RUN echo "Текущая директория перед извлечением: $(pwd)"
RUN ls -la
RUN ls -la build/libs/
RUN mkdir -p build/dependency && (cd build/dependency; ls -la; jar -xf ../libs/app-0.0.1-SNAPSHOT.jar)

FROM openjdk:17 as runner

ARG DEPENDENCY=/app/build/dependency

COPY --from=build ${DEPENDENCY}/BOOT-INF/lib /app/lib
COPY --from=build ${DEPENDENCY}/META-INF /app/META-INF
COPY --from=build ${DEPENDENCY}/BOOT-INF/classes /app

ENTRYPOINT ["java", "-cp", "/app:/app/lib/*", "ru.cs.korotaev.CollaborativeTextEditor.CollaborativeTextEditorApplicationKt"]