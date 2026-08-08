FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go/go.mod go/go.sum ./
RUN go mod download

COPY go/*.go ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /sandbox-storage .

FROM alpine:3.19

RUN apk --no-cache add ca-certificates \
    && adduser -D -g '' -u 1001 appuser

WORKDIR /app

COPY --from=builder /sandbox-storage .

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8787

ENTRYPOINT ["./sandbox-storage"]
