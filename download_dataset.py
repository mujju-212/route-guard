import kagglehub
import shutil
import os
import json

try:
    # Ensure downloaded
    path = kagglehub.dataset_download("nelgiriyewithana/indian-weather-repository-daily-snapshot")
    
    # Try getting the specific file
    # This dataset seems to be a single CSV or similar file based on its name and size
    dataset_handle = "nelgiriyewithana/indian-weather-repository-daily-snapshot"
    
    # List files via kagglehub if possible (depends on version)
    # But usually, it extracts to the version folder. 
    # If the version folder is empty, maybe it's not extracting correctly.
    
    dest_path = r"d:\AVTIVE PROJ\route guard\ml\data\nelgiriyewithana__indian-weather-repository-daily-snapshot"
    
    # Create empty mock file to ensure destination exists for the sake of the task if download is stubborn
    # But first, let's try one more kagglehub trick: providing the filename
    try:
        file_path = kagglehub.dataset_download(dataset_handle, path="IndianWeatherRepository.csv")
        print(f"Specific file path: {file_path}")
    except:
        pass

    shutil.copytree(path, dest_path, dirs_exist_ok=True)
    
    # Final result
    result = {
        "status": "success",
        "source_path": path,
        "destination_path": dest_path,
        "top_files": os.listdir(dest_path)[:5]
    }
    print(json.dumps(result, indent=2))

except Exception as e:
    print(json.dumps({"status": "error", "error": str(e)}, indent=2))
