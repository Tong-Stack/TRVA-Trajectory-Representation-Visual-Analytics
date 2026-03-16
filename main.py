import pandas as pd
import h3
import numpy as np
import json
import torch
import os
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
def load_and_preprocess_data(file_path):
    print(f"Loading data from {file_path}...")
    try:
        df = pd.read_csv(file_path, encoding='gb18030')
    except UnicodeDecodeError:
        df = pd.read_csv(file_path, encoding='utf-8')

    print(f"Data loaded. Shape: {df.shape}")

    text_cols = ['Name', 'FirstLevel', 'SecondLevel', 'ThirdLevel']
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].fillna('')

    def clean_type(text):
        return str(text).replace(';', ' ')

    tqdm.pandas(desc="Constructing text")

    def construct_text(row):
        name = row.get('Name', '')
        l1 = clean_type(row.get('FirstLevel', ''))
        l2 = clean_type(row.get('SecondLevel', ''))
        l3 = clean_type(row.get('ThirdLevel', ''))

        types = [t for t in [l1, l2, l3] if t]
        type_str = " - ".join(types)

        return f"名称: {name}; 类型: {type_str}"

    df['text_for_embedding'] = df.progress_apply(construct_text, axis=1)

    return df

def get_h3_index(lat, lon, resolution=8):
    try:
        return h3.latlng_to_cell(lat, lon, resolution)
    except Exception:
        return None

def main():

    INPUT_FILE = r"Data/shenzhen_poi_2022_ZoneID.csv"
    OUTPUT_FILE = "grid_embeddings.geojson"
    MODEL_NAME = "./BAAI/bge-m3"
    H3_RES = 8

    if not os.path.exists(INPUT_FILE):
        INPUT_FILE = os.path.join(os.getcwd(), "Data", "shenzhen_poi_2022_ZoneID.csv")

    # 1️⃣ 读取数据
    df = load_and_preprocess_data(INPUT_FILE)

    # 2️⃣ embedding
    print(f"Loading embedding model: {MODEL_NAME}...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SentenceTransformer(MODEL_NAME, device=device)

    print("Encoding text...")
    embeddings = model.encode(df['text_for_embedding'].tolist(), show_progress_bar=True,batch_size=128)

    # 3️⃣ H3聚合
    print("Calculating H3 indices...")
    df['h3_id'] = df.apply(lambda x: get_h3_index(x['Lat'], x['Lon'], H3_RES), axis=1)
    df = df.dropna(subset=['h3_id'])

    print("Aggregating by H3 grid...")

    df['emb_idx'] = range(len(df))
    grouped = df.groupby('h3_id')

    unique_h3_ids = list(grouped.groups.keys())
    h3_to_idx = {h3_id: i for i, h3_id in enumerate(unique_h3_ids)}

    num_grids = len(unique_h3_ids)
    embedding_dim = embeddings.shape[1]
    grid_embeddings = np.zeros((num_grids, embedding_dim))

    # 统计 dominant 类型
    dominant_types = grouped['FirstLevel'].apply(lambda x: x.value_counts().index[0] if len(x) > 0 else "Unknown")
    dominant_counts = grouped['FirstLevel'].apply(lambda x: x.value_counts().iloc[0] if len(x) > 0 else 0)
    total_counts = grouped['FirstLevel'].count()
    dominant_percents = (dominant_counts / total_counts * 100).round(1)

    # 统计 POI 数量
    poi_counts = grouped.size()

    print("Mean pooling embeddings...")
    for h3_id, group_indices in tqdm(grouped.indices.items(), total=num_grids):
        idx = h3_to_idx[h3_id]
        grid_embeddings[idx] = np.mean(embeddings[group_indices], axis=0)

    # 4️⃣ 构建 GeoJSON（你要的中间文件）
    print("Building GeoJSON...")

    features = []

    for i, h3_id in enumerate(tqdm(unique_h3_ids)):

        boundary = h3.cell_to_boundary(h3_id)
        coords = [[pt[1], pt[0]] for pt in boundary]

        if coords[0] != coords[-1]:
            coords.append(coords[0])

        dom_type = dominant_types[h3_id]
        dom_pct = dominant_percents[h3_id]
        info_str = f"{dom_type} (占比{dom_pct}%)"

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords]
            },
            "properties": {
                "h3_id": h3_id,
                "embedding": grid_embeddings[i].tolist(),
                "info": info_str,
                "poi_count": int(poi_counts[h3_id]),
                "dominant_type": dom_type
            }
        }

        features.append(feature)

    geojson_output = {
        "type": "FeatureCollection",
        "features": features
    }

    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(geojson_output, f, ensure_ascii=False, indent=2)

    print("Done!")

if __name__ == "__main__":
    main()