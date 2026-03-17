## 1. Image Forensics (DeepPixel Ensemble)
Orchestrates a **12-Layer Pipeline** for pixel-level and semantic analysis.

### A. Heuristic & Visual (Client-Side)
-   **OCR (Optical Character Recognition)**: Integrated `Tesseract.js` for client-side text extraction from images.
-   **Logic**: Scans images for embedded phishing text, bank brand logos (via feature matching), and "Call to Action" overlays that evade traditional HTML filters.

### B. ML & Frequency Domains (Military-Grade)
1.  **Vision Transformer (ViT)**: semantic classification via `transformers` (backend).
2.  **FFT-style Radial Periodicity**: Detects periodic lattice artifacts typical of GAN upsampling.
    *   **Marker**: Periodicity value $<1.0$ triggers a high-confidence synthetic flag.
3.  **DCT Grid Seam Analysis**: Scans 8x8 (GAN) and 16x16 (Diffusion) block boundaries for mathematical continuity.
4.  **Haar Wavelet Noise Residue**: Extraction of the HH band to identify high-frequency synthetic residue.
5.  **PRNU (Photo-Response Non-Uniformity)**: Extracts "Sensor DNA."
    *   **Threshold**: $\sigma_{noise} < 0.9$ (physical camera signal absent).
    *   **Marker**: Spatial uniformity variance $< 0.3$ indicates injected noise.

### C. Color & Statistical Forensics
-   **RGB Palette Correlation**: Pearson correlation tracking across channels.
    *   **Trigger**: Correlation $> 0.97$ indicating "Channel Collapse."
-   **Multi-Channel Histogram Flatness**: Detects "Perfectly Filled" bins indicative of synthetic generation.
    *   **Marker**: Average empty bins $< 4$ (Diffusion signature).
-   **Block Shannon Entropy**: Measures spatial randomness across 32x32 tiles.
    *   **Formula**: $H = -\sum_{i=0}^{n-1} p_i \log_2 p_i$
    *   **Trigger**: $\sigma_{entropy} < 0.35$ (Artificial uniformity).
-   **ELA (Error Level Analysis)**: Multi-pass extraction across 92, 75, and 55 Quality levels.
    *   **Baseline**: $ELA_{high} < 1.8$ at Q=92 (AI over-compression signature).
4.  **PRNU Proxy extraction**: Extracting sensor-noise residuals to verify physical camera origins.
5.  **DCT Grid Artifacts**: Detects 8x8 and 16x16 grid alignment discrepancies from AI generation.
6.  **Color Correlation (RGB)**: Identifies channel collapse (correlation > 0.97) typical in synthetic media.
7.  **Histogram Analysis**: Detection of perfectly filled bins and "Artificial Flatness."
8.  **Block Entropy**: Shannon entropy calculation across 32x32 blocks to find low-randomness zones.
9.  **Tesseract.js OCR**: Integrated client-side text extraction for phishing keywords inside pixels.

### B. Backend ML & Metadata (safe.py)
10. **ViT (Vision Transformer)**: Semantic classification via `transformers` (optional but implemented).
11. **Reality Defender API**: Shadow evaluation against global AI-media lab fingerprints.
12. **Patch Consistency**: Intra-region statistical variance detection (16x16 block analysis).

---

## 2. Voice Clone Forensics (AcousticDNA)
Detects synthetic speech via temporal and spectral inconsistencies.

### A. Biological Law Compliance
1.  **Vocal Tract Modeling**: Checks if the audio frequencies (Formants) comply with human biological dimensions (Length $L \approx 17cm$ for adults).
2.  **Breathing Patterns**: Natural humans require breath pauses; AI TTS (Text-to-Speech) often lacks "Inhale" signatures or has rhythmic silence perfection.

### B. Temporal Variability
-   **Micro-Tremor Analysis**: Scans for the absence of natural human nerve tremors in speech (8-12Hz micro-modulations).
-   **Attack/Decay analysis**: Detection of "Neural Blur" in the start and end of syllables.

### C. Acoustic Feature Vector (25-Dimension)
-   **Spectral Energy Variance**: Coefficient of Variation ($CoV < 0.15$) indicates robotic energy consistency.
-   **Zero-Crossing Rate Stability**: Pitch stability analysis ($CoV < 0.08$ = Neural TTS).
-   **Micro-Tremor (Jitter)**: Detection of frequency instability ($AvgJitter < 0.01$ = Synthetic).
-   **Micro-Phase Coherence**: Tracking zero-crossing interval variance ($zcCV < 0.35$).
-   **Spectral Entropy Proxy**: Wav2Vec2-derived complexity markers ($H < 4.5$ = Generative).
-   **Pitch-Formant Correlation**: Cross-domain structural consistency cross-check.

### D. Video & Temporal (Gen-4)
-   **Optical Flow Continuity**: Pixel velocity tracking between frames.
-   **Landmark Drift Tracking**: 68-point facial mesh jitter detection (mask slippage).
-   **Physiological Liveness**: Blink rate and micro-expression verification.

---

## 3. URL and Domain Analysis (ZTAS-NLP)
Orchestrates **30+ Threat Categories** through the "Triple-Lock" pipeline.

### A. The 7-Layer URL Scan & Advanced Network Defense
1.  **L1 - Architecture**: Protocol integrity.
2.  **L2 - Char Forensics**: Homoglyphs and Zero-Width characters.
3.  **L3 - Fast-Flux DNS**: Detects rapid IP rotation and low TTL (<120s) infrastructure.
4.  **L4 - CNAME Chain Mismatch**: Detecting "Domain Shadowing" pointing to serverless workers.
5.  **L5 - API Fusion**: GSB + PageRank + Reality Defender.
6.  **L6 - Quishing & OAuth**: Decoding QR codes and scanning auth redirect intents.
7.  **L7 - RDAP Age validation**: Newly Registered Domain (NRD) isolation.

---

## 4. Architectural Governance & Hardening
-   **Adversarial Probe Detector**: Throttles clients probing the decision boundary.
-   **Score Noise Injection**: Injects Gaussian noise into scores for "probe" clients to prevent reverse-engineering.
-   **Zero-Tolerance (ZT-01 to ZT-15)**: Hardcoded logic-gates for critical threats (WASM execution, ServiceWorkers).
-   **Secret Masking**: Dynamic redaction filter for log observability.
-   **Circuit Breakers**: Automatic failover for high-latency external APIs.

---

## 5. Technical Decision Engine
-   **ML Core**: GradientBoosting Classifier (scikit-learn) with 200 trees for feature fusion.
-   **Sentinel Synthesis**: Gemini 1.5 Pro performs the final contextual verdict based on raw forensic metadata.
