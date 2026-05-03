# Microsoft x AIAT Final Hackathon (Group 10)

## Team Member

- ภูมิ ยิ้มเยื้อน (5643AA)
- ฐิตารีย์ คำเขียว (590CB2)
- ชวณัฎฐ์ พรหมภักดี (722E75)
- อิทธิกร คำมี (B1704C)

## Model

The app uses a **U-Net** for **binary wound segmentation** on foot-ulcer images: given an RGB photo, the model predicts a single-channel mask (wound vs background). The same architecture and weights power the **`/predict`** API in `api/`.

### Training 

- **`model/Microsoft_X_AIAT_Final_Hackathon_2.ipynb`** — end-to-end setup: dataset paths, **Albumentations** transforms, dataloaders, `UNet`, **BCE with logits + Dice** composite loss, optimizer, training loop, validation metrics (Dice / IoU), checkpointing, and plots.

**Data**: [DFUC 2022 train release](https://www.kaggle.com/datasets/pabodhamallawa/dfuc2022-train-release) on Kaggle (images and masks under `DFUC2022_train_release`). The notebook uses a **stratified train/validation split** by **wound area ratio** to keep validation representative.

**Input geometry and normalization** (aligned with inference in `api/main.py`): resize to **384×512**, then **ImageNet** mean/std normalization (`0.485 / 0.456 / 0.406` and `0.229 / 0.224 / 0.225`).

### Google Colab 

You can open and run the full pipeline (including downloads on Kaggle / Colab) here: [Google Colab — Microsoft × AIAT Hackathon model](https://colab.research.google.com/drive/1e-sigMWw0QuflJ54r7btq-34b8oiSkzr?usp=sharing).

## Setup

This project is split into two parts:

- `web/` — Frontend built with **React 19 + TypeScript + Vite**.
- `api/` — Backend built with **FastAPI + PyTorch** that serves a U-Net wound segmentation model.

### Prerequisites

- **Node.js** `>= 20` and **pnpm** `>= 9` (for the web app)
- **Python** `>= 3.10` and **pip** (for the API)
- **Git** (to clone this repository)
- *(Optional)* **Docker** if you prefer running the API in a container
- *(Optional)* **GNU Make** to use the provided `Makefile` shortcuts

Clone the repository first:

```bash
git clone https://github.com/lebrancconvas/Microsoft-AIAT-Hackathon-Group10.git
cd Microsoft-AIAT-Hackathon-Group10
```

### Web

The web app is a Vite-powered React app located in the `web/` directory.

1. Move into the `web/` directory:

   ```bash
   cd web
   ```

2. Install dependencies with pnpm:

   ```bash
   pnpm install
   ```

3. Configure the API endpoint. Create a `.env` (or `.env.local`) file in `web/` and point it at your local API:

   ```env
   VITE_API_URL=http://localhost:8000/
   ```

   > A `.env.production` is already included for the deployed Azure Container Apps backend. Use `.env.local` for local development so it does not override the production config.

4. Start the dev server:

   ```bash
   pnpm dev
   ```

   The app will be available at [http://localhost:5173](http://localhost:5173) with hot module replacement enabled.

5. Other useful scripts:

   ```bash
   pnpm lint       # run ESLint
   pnpm build      # type-check and build for production into dist/
   pnpm preview    # preview the production build locally
   ```

   You can also expose the dev server publicly via ngrok using the included `Makefile`:

   ```bash
   make run-ngrok  # runs: ngrok http 5173
   ```

### API

The API is a FastAPI service that loads a pre-trained U-Net model (`best_unet_dfuc2022.pth`) and exposes a `/predict` endpoint for wound image segmentation and risk scoring.

1. Move into the `api/` directory:

   ```bash
   cd api
   ```

2. Create and activate a Python virtual environment:

   ```bash
   python -m venv venv

   # Linux / macOS
   source venv/bin/activate

   # Windows (PowerShell)
   .\venv\Scripts\Activate.ps1
   ```

3. Install the Python dependencies:

   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

   > On Linux you may need a few system packages used by `opencv-python-headless` (already installed on most distros): `libglib2.0-0`, `libsm6`, `libxext6`, `libxrender-dev`, `libgomp1`.

4. Make sure the model weights file `best_unet_dfuc2022.pth` exists in the `api/` directory (it ships with this repo).

5. Run the development server:

   ```bash
   uvicorn main:app --reload
   ```

   Or, equivalently, using the provided `Makefile`:

   ```bash
   make run
   ```

   The API will be available at [http://localhost:8000](http://localhost:8000), with interactive Swagger docs at [http://localhost:8000/docs](http://localhost:8000/docs).

#### Run with Docker (optional)

A `Dockerfile` is provided if you prefer not to manage a local Python environment:

```bash
cd api
docker build -t ai-hack-g10-api .
docker run --rm -p 8000:8000 ai-hack-g10-api
```

The container exposes the API on port `8000`, matching the `VITE_API_URL` shown in the Web setup above.

#### API endpoints

| Method | Path       | Description                                                                 |
| ------ | ---------- | --------------------------------------------------------------------------- |
| `GET`  | `/`        | Health check — returns `{"message": "Hello World"}`.                        |
| `POST` | `/predict` | Multipart form: `file` (image), `timeline_day` (int), `symptoms` (CSV str). Returns the wound mask, overlay, area ratio, and risk score. |

