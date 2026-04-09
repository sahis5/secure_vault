import * as amqplib from 'amqplib';

console.log("Notification service started.");

// In a real implementation we would connect to RabbitMQ and listen for 'risk.high' and 'healing.complete'
