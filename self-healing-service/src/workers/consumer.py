import os
import pika
import json
import logging
import time

logger = logging.getLogger(__name__)
RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

def trigger_background_reencryption(user_id):
    """
    In a real scenario, this enqueues a Celery job to fetch all files for this user,
    call encryption-service to rotate keys, and updates minio.
    """
    logger.info(f"Triggering background RE-ENCRYPTION process for user: {user_id}")
    time.sleep(1)

def start_consumer():
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()
    channel.queue_declare(queue='risk.high', durable=True)

    def callback(ch, method, properties, body):
        try:
            data = json.loads(body)
            user_id = data.get("user_id")
            risk_level = data.get("risk_level")
            
            logger.warning(f"HIGH RISK EVENT CAUGHT: User {user_id} - Level {risk_level}. Initializing self-healing...")
            
            # Step 1: Isolate (revoke tokens, lock account in auth-service via HTTP call or DB depending on spec)
            # Step 2: Trigger re-encryption
            trigger_background_reencryption(user_id)
            
            # Since this is a critical action, we acknowledge only if successful
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            logger.error(f"Error handling healing event: {e}")
            # Do not ack if failed so it goes to DLQ or retries

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue='risk.high', on_message_callback=callback)
    
    logger.info('Waiting for risk.high messages to trigger Self-Healing.')
    channel.start_consuming()

if __name__ == "__main__":
    start_consumer()
