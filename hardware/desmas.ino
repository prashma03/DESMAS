// DESMAS live firmware (Arduino Mega)
// The board runs the power rules on its own and streams its readings to the DESMAS web app.
//
// Light sensor (A0) -> how dark it is, 0 to 100%. Systems switch off lowest priority first:
//   30% dark  P4 Comfort off       (red LED, pin 11)
//   55% dark  P3 Science off       (yellow LED, pin 10)   this is "lunar night"
//   85% dark  P2 Comms low power   (blue LED blinks, pin 9)
//   P1 Life support                (green LED, pin 8) always stays on
// DHT11 (pin 2) -> humidity 10 points above the startup value sounds the buzzer (pin 7).
//
// Serial at 9600 baud: one JSON line every 500 ms, for example
//   {"ms":61500,"light":233,"lbase":230,"dark":1,"hum":52.0,"hbase":52.0,"cut":62.0,"temp":27.4,"alarm":0,"muted":0,"dht":1,"leds":[1,1,1,1]}
// Close the Arduino Serial Monitor before the web app connects. Only one program can use the port.
// Commands: send c to recalibrate in a new room (keep the light sensor uncovered), m to mute or unmute the buzzer.

#include <DHT.h>

const int LED_PINS[4] = {8, 9, 10, 11};  // P1 life support, P2 comms, P3 science, P4 comfort
const int BUZZER_PIN = 7;
const int LIGHT_PIN = A0;
const int DHT_PIN = 2;

const int DARK_SPAN = 450;          // light reading this far above normal counts as 100% dark
const int SHED_COMFORT = 30;        // % dark
const int SHED_SCIENCE = 55;
const int COMMS_LOW = 85;
const int GAP = 4;                  // stops LEDs flickering when the reading sits on a limit
const float HUMIDITY_RISE = 10.0;   // alarm when humidity is this many points above normal
const float HUMIDITY_CLEAR = 2.0;   // alarm clears this far below the cutoff

DHT dht(DHT_PIN, DHT11);

float lightAvg = 0;
int lightBase = 0;
float humBase = 50;
float humidity = NAN;
float temperature = NAN;
bool dhtOk = false;
bool alarmOn = false;
bool muted = false;
bool beeping = false;
int leds[4] = {1, 1, 1, 1};         // 1 on, 0 off, 2 low power

unsigned long lastDht = 0;
unsigned long lastSend = 0;

void calibrate() {
  long sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += analogRead(LIGHT_PIN);
    delay(25);
  }
  lightBase = sum / 20;
  lightAvg = lightBase;

  for (int i = 0; i < 5; i++) {     // the DHT11 misses a reading now and then
    float h = dht.readHumidity();
    if (!isnan(h)) {
      humBase = h;
      humidity = h;
      break;
    }
    delay(1100);
  }
  alarmOn = false;

  Serial.print("{\"event\":\"calibrated\",\"lbase\":");
  Serial.print(lightBase);
  Serial.print(",\"hbase\":");
  Serial.print(humBase, 1);
  Serial.print(",\"cut\":");
  Serial.print(humBase + HUMIDITY_RISE, 1);
  Serial.println("}");
}

// 1 = keep on, 0 = turn off
int rule(int current, int dark, int limit) {
  if (dark >= limit) return 0;
  if (dark <= limit - GAP) return 1;
  return current;
}

void setup() {
  Serial.begin(9600);

  pinMode(3, OUTPUT);               // DHT11 sits in pins 2, 3, 4: pin 3 powers it
  digitalWrite(3, HIGH);
  pinMode(4, OUTPUT);               // pin 4 is its ground
  digitalWrite(4, LOW);
  dht.begin();

  for (int i = 0; i < 4; i++) pinMode(LED_PINS[i], OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LIGHT_PIN, INPUT_PULLUP); // built-in resistor replaces the 10k resistor

  delay(2000);                      // the DHT11 needs a moment after power-up
  calibrate();
}

void loop() {
  unsigned long now = millis();

  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'c') calibrate();
    if (c == 'm') muted = !muted;
  }

  // Light: higher reading = darker. Smooth it so a flicker does not switch systems.
  lightAvg = lightAvg * 0.8 + analogRead(LIGHT_PIN) * 0.2;
  int dark = constrain((long)(lightAvg - lightBase) * 100 / DARK_SPAN, 0, 100);

  // The DHT11 gives a new reading about every 2 seconds
  if (now - lastDht >= 2000) {
    lastDht = now;
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    dhtOk = !(isnan(h) || isnan(t));
    if (dhtOk) {
      humidity = h;
      temperature = t;
    }
  }

  // Power rules, lowest priority first
  leds[0] = 1;
  leds[1] = rule(leds[1] == 2 ? 0 : 1, dark, COMMS_LOW) == 1 ? 1 : 2;
  leds[2] = rule(leds[2], dark, SHED_SCIENCE);
  leds[3] = rule(leds[3], dark, SHED_COMFORT);

  for (int i = 0; i < 4; i++) {
    bool lit = leds[i] == 1 || (leds[i] == 2 && (now / 400) % 2 == 0);
    digitalWrite(LED_PINS[i], lit ? HIGH : LOW);
  }

  // Humidity alarm: short beep every 1.5 s while it is on
  float cutoff = humBase + HUMIDITY_RISE;
  if (!isnan(humidity)) {
    if (humidity >= cutoff) alarmOn = true;
    else if (humidity <= cutoff - HUMIDITY_CLEAR) alarmOn = false;
  }
  bool beepNow = alarmOn && !muted && (now % 1500) < 150;
  if (beepNow && !beeping) tone(BUZZER_PIN, 2000);
  if (!beepNow && beeping) noTone(BUZZER_PIN);
  beeping = beepNow;

  if (now - lastSend >= 500) {
    lastSend = now;
    Serial.print("{\"ms\":");
    Serial.print(now);
    Serial.print(",\"light\":");
    Serial.print((int)lightAvg);
    Serial.print(",\"lbase\":");
    Serial.print(lightBase);
    Serial.print(",\"dark\":");
    Serial.print(dark);
    Serial.print(",\"hum\":");
    if (isnan(humidity)) Serial.print("null"); else Serial.print(humidity, 1);
    Serial.print(",\"hbase\":");
    Serial.print(humBase, 1);
    Serial.print(",\"cut\":");
    Serial.print(cutoff, 1);
    Serial.print(",\"temp\":");
    if (isnan(temperature)) Serial.print("null"); else Serial.print(temperature, 1);
    Serial.print(",\"alarm\":");
    Serial.print(alarmOn ? 1 : 0);
    Serial.print(",\"muted\":");
    Serial.print(muted ? 1 : 0);
    Serial.print(",\"dht\":");
    Serial.print(dhtOk ? 1 : 0);
    Serial.print(",\"leds\":[");
    for (int i = 0; i < 4; i++) {
      Serial.print(leds[i]);
      if (i < 3) Serial.print(",");
    }
    Serial.println("]}");
  }

  delay(20);
}
