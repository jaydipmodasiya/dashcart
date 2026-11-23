
FROM eclipse-temurin:17-jdk AS build

WORKDIR /app

COPY backend/src ./backend/src

RUN mkdir -p backend/out \
    && javac -encoding UTF-8 -d backend/out backend/src/dashcart/*.java

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/backend/out ./backend/out
COPY frontend ./frontend

RUN mkdir -p data

ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "java -cp backend/out dashcart.Main ${PORT:-8080} frontend 1"]
