import csv
import random
import time
import uuid

NUM_RECORDS = 5000
ATTACK_RATIO = 0.05

def generate_dataset(filename="access_logs.csv"):
    with open(filename, 'w', newline='') as csvfile:
        fieldnames = [
            'timestamp', 'user_id', 'action_type', 'ip_location_mismatch', 
            'download_count_last_1h', 'failed_logins_last_1h', 'bytes_transferred_last_1h', 'label_anomaly'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        base_time = int(time.time()) - (NUM_RECORDS * 10)
        users = [str(uuid.uuid4()) for _ in range(50)]
        target_attack_user = users[0]

        for i in range(NUM_RECORDS):
            is_attack = random.random() < ATTACK_RATIO
            current_time = base_time + (i * random.randint(1, 20))
            
            if is_attack:
                # Harvest-Now-Decrypt-Later Attack signature
                user = target_attack_user
                action = 'download'
                mismatch = 1 if random.random() < 0.9 else 0
                download_count = random.randint(50, 500)
                failed_logins = random.randint(0, 2)
                bytes_xfer = random.randint(100 * 1024 * 1024, 1024 * 1024 * 1024) # 100MB to 1GB
                label = 1
            else:
                # Normal traffic
                user = random.choice(users)
                action = random.choice(['login', 'upload', 'download', 'list'])
                mismatch = 1 if random.random() < 0.01 else 0
                
                if action == 'download':
                    download_count = random.randint(1, 5)
                    bytes_xfer = random.randint(1024, 5 * 1024 * 1024) # 1KB to 5MB
                else:
                    download_count = random.randint(0, 2)
                    bytes_xfer = random.randint(100, 1024*1024)
                    
                failed_logins = random.randint(0, 1) if action == 'login' else 0
                label = 0

            writer.writerow({
                'timestamp': current_time,
                'user_id': user,
                'action_type': action,
                'ip_location_mismatch': mismatch,
                'download_count_last_1h': download_count,
                'failed_logins_last_1h': failed_logins,
                'bytes_transferred_last_1h': bytes_xfer,
                'label_anomaly': label
            })

if __name__ == "__main__":
    generate_dataset()
    print("synthetic dataset access_logs.csv generated with 5000 records.")
