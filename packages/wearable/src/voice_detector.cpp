#include "voice_detector.h"

VoiceDetector::VoiceDetector() {
    currentState = VOICE_IDLE;
    isInitialized = false;
    recordingActive = false;
    audioBuffer = nullptr;
    bufferSize = SAMPLE_BUFFER_SIZE;
    bufferIndex = 0;
    energyThreshold = VOICE_THRESHOLD;
    lastVoiceActivity = 0;
    wakeWordDetected = false;
    recordingStartTime = 0;
    maxRecordingDuration = RECORDING_DURATION_MS;
}

VoiceDetector::~VoiceDetector() {
    end();
}

bool VoiceDetector::begin() {
    Serial.println("Initializing Voice Detector...");
    
    // Allocate audio buffer
    audioBuffer = (int16_t*)malloc(bufferSize * sizeof(int16_t));
    if (!audioBuffer) {
        Serial.println("Failed to allocate audio buffer");
        return false;
    }
    
    // Initialize I2S for microphone input
    if (!initializeI2S()) {
        Serial.println("Failed to initialize I2S");
        free(audioBuffer);
        audioBuffer = nullptr;
        return false;
    }
    
    currentState = VOICE_LISTENING;
    isInitialized = true;
    
    Serial.println("Voice Detector initialized successfully");
    return true;
}

void VoiceDetector::end() {
    if (isInitialized) {
        deinitializeI2S();
        
        if (audioBuffer) {
            free(audioBuffer);
            audioBuffer = nullptr;
        }
        
        isInitialized = false;
        currentState = VOICE_IDLE;
    }
}

bool VoiceDetector::initializeI2S() {
    // Configure I2S for microphone input
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX | I2S_MODE_ADC_BUILT_IN),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_I2S_LSB,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 1024,
        .use_apll = false,
        .tx_desc_auto_clear = false,
        .fixed_mclk = 0
    };
    
    // Install I2S driver
    esp_err_t err = i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
    if (err != ESP_OK) {
        Serial.printf("Failed to install I2S driver: %d\n", err);
        return false;
    }
    
    // Set ADC pin for microphone input
    err = i2s_set_adc_mode(ADC_UNIT_1, ADC1_CHANNEL_6); // GPIO34
    if (err != ESP_OK) {
        Serial.printf("Failed to set ADC mode: %d\n", err);
        i2s_driver_uninstall(I2S_NUM_0);
        return false;
    }
    
    // Enable ADC
    err = i2s_adc_enable(I2S_NUM_0);
    if (err != ESP_OK) {
        Serial.printf("Failed to enable ADC: %d\n", err);
        i2s_driver_uninstall(I2S_NUM_0);
        return false;
    }
    
    return true;
}

void VoiceDetector::deinitializeI2S() {
    i2s_adc_disable(I2S_NUM_0);
    i2s_driver_uninstall(I2S_NUM_0);
}

void VoiceDetector::update() {
    if (!isInitialized) {
        return;
    }
    
    // Read audio data from I2S
    size_t bytesRead = 0;
    int16_t samples[128];
    
    esp_err_t err = i2s_read(I2S_NUM_0, samples, sizeof(samples), &bytesRead, 10);
    if (err == ESP_OK && bytesRead > 0) {
        size_t samplesRead = bytesRead / sizeof(int16_t);
        
        // Process audio based on current state
        switch (currentState) {
            case VOICE_LISTENING:
                if (detectVoiceActivity(samples, samplesRead)) {
                    if (processWakeWord(samples, samplesRead)) {
                        wakeWordDetected = true;
                    }
                }
                break;
                
            case VOICE_RECORDING:
                // Store samples in buffer for transmission
                for (size_t i = 0; i < samplesRead && bufferIndex < bufferSize; i++) {
                    audioBuffer[bufferIndex++] = samples[i];
                }
                
                // Check if recording should stop
                if (millis() - recordingStartTime > maxRecordingDuration || bufferIndex >= bufferSize) {
                    stopRecording();
                }
                break;
                
            default:
                break;
        }
    }
}

bool VoiceDetector::detectVoiceActivity(int16_t* samples, size_t count) {
    float energy = calculateEnergy(samples, count);
    
    if (energy > energyThreshold) {
        lastVoiceActivity = millis();
        return true;
    }
    
    return false;
}

float VoiceDetector::calculateEnergy(int16_t* samples, size_t count) {
    float energy = 0.0;
    
    for (size_t i = 0; i < count; i++) {
        float sample = (float)samples[i] / 32768.0;
        energy += sample * sample;
    }
    
    return energy / count;
}

bool VoiceDetector::processWakeWord(int16_t* samples, size_t count) {
    // Simplified wake word detection based on energy patterns
    // In a real implementation, this would use more sophisticated
    // algorithms like keyword spotting or neural networks
    
    static float energyHistory[10] = {0};
    static int historyIndex = 0;
    
    float currentEnergy = calculateEnergy(samples, count);
    energyHistory[historyIndex] = currentEnergy;
    historyIndex = (historyIndex + 1) % 10;
    
    // Look for energy pattern that matches "Hey BIL"
    // This is a very basic implementation
    float avgEnergy = 0;
    for (int i = 0; i < 10; i++) {
        avgEnergy += energyHistory[i];
    }
    avgEnergy /= 10;
    
    // Simple threshold-based detection
    if (currentEnergy > avgEnergy * 2.0 && currentEnergy > energyThreshold * 1.5) {
        return true;
    }
    
    return false;
}

bool VoiceDetector::detectWakeWord() {
    if (wakeWordDetected) {
        wakeWordDetected = false;
        return true;
    }
    return false;
}

void VoiceDetector::setWakeWordThreshold(float threshold) {
    energyThreshold = threshold;
}

bool VoiceDetector::startRecording() {
    if (!isInitialized || currentState == VOICE_RECORDING) {
        return false;
    }
    
    Serial.println("Starting voice recording...");
    
    // Clear buffer and reset index
    bufferIndex = 0;
    recordingStartTime = millis();
    currentState = VOICE_RECORDING;
    recordingActive = true;
    
    return true;
}

bool VoiceDetector::stopRecording() {
    if (currentState != VOICE_RECORDING) {
        return false;
    }
    
    Serial.printf("Stopping voice recording. Recorded %d samples\n", bufferIndex);
    
    currentState = VOICE_LISTENING;
    recordingActive = false;
    
    return true;
}

bool VoiceDetector::isRecording() {
    return recordingActive;
}

int16_t* VoiceDetector::getAudioBuffer() {
    return audioBuffer;
}

size_t VoiceDetector::getBufferSize() {
    return bufferSize;
}

size_t VoiceDetector::getRecordedSamples() {
    return bufferIndex;
}

void VoiceDetector::clearBuffer() {
    bufferIndex = 0;
}

VoiceState VoiceDetector::getState() {
    return currentState;
}

bool VoiceDetector::isInitialized() {
    return isInitialized;
}