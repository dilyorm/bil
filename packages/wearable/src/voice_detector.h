#ifndef VOICE_DETECTOR_H
#define VOICE_DETECTOR_H

#include <Arduino.h>
#include <driver/i2s.h>
#include <driver/adc.h>
#include "config.h"

enum VoiceState {
    VOICE_IDLE,
    VOICE_LISTENING,
    VOICE_RECORDING,
    VOICE_PROCESSING
};

class VoiceDetector {
private:
    VoiceState currentState;
    bool isInitialized;
    bool recordingActive;
    
    // Audio buffers
    int16_t* audioBuffer;
    size_t bufferSize;
    size_t bufferIndex;
    
    // Wake word detection
    float energyThreshold;
    uint32_t lastVoiceActivity;
    bool wakeWordDetected;
    
    // Recording management
    uint32_t recordingStartTime;
    uint32_t maxRecordingDuration;
    
    // Audio processing methods
    bool initializeI2S();
    void deinitializeI2S();
    float calculateEnergy(int16_t* samples, size_t count);
    bool detectVoiceActivity(int16_t* samples, size_t count);
    bool processWakeWord(int16_t* samples, size_t count);
    void processAudioBuffer();

public:
    VoiceDetector();
    ~VoiceDetector();
    
    bool begin();
    void end();
    void update();
    
    // Wake word detection
    bool detectWakeWord();
    void setWakeWordThreshold(float threshold);
    
    // Recording control
    bool startRecording();
    bool stopRecording();
    bool isRecording();
    
    // Audio data access
    int16_t* getAudioBuffer();
    size_t getBufferSize();
    size_t getRecordedSamples();
    void clearBuffer();
    
    // State management
    VoiceState getState();
    bool isInitialized();
};

#endif // VOICE_DETECTOR_H