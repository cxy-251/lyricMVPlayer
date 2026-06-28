float bass = texture2D(uAudioTex, vec2(0.01, 0.5)).r;
// Color pulses with the music!
return mix(uColor, vec3(1.0, 0.0, 0.5), bass * 1.5);
