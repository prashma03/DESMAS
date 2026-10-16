# Firmware (Arduino Mega)

Pin map from the project summary. The sketch itself is not in this repo yet; drop the `.ino` here when you have it.

| Part | Pin | Role |
| --- | --- | --- |
| USB serial | — | 9600 baud JSON, ~2 Hz |
| Green LED | 8 | P1 life support / vaccine fridge |
| Blue LED | 9 | P2 comms / radio |
| Yellow LED | 10 | P3 science / clinic lights |
| Red LED | 11 | P4 comfort / fan |
| Buzzer | 7 | Humidity alarm |
| Photoresistor | A0 | Internal pull-up; higher reading = darker |
| DHT11 data / VCC / GND | 2 / 3 / 4 | Humidity and temperature |

Serial: send `c` to recalibrate (sensor uncovered), `m` to mute the buzzer.

Example line:

```json
{"ms":61500,"light":233,"lbase":230,"dark":1,"hum":52.0,"hbase":52.0,"cut":62.0,"temp":27.4,"alarm":0,"muted":0,"dht":1,"leds":[1,1,1,1]}
```
