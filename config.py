"""
Configuration Management
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class Config:
    """Application configuration"""
    
    DEFAULT_CONFIG = {
        'quarantine': {
            'max_size_gb': 1,
            'path': './quarantine',
            'auto_cleanup': True
        },
        'scanning': {
            'enable_signature_db': True,
            'enable_heuristics': True,
            'max_file_size_mb': 100
        },
        'monitoring': {
            'paths': ['D:\\', 'E:\\', 'F:\\', '/media/', '/mnt/'],
            'excluded_extensions': ['.tmp', '.temp', '.lnk', '.part']
        },
        'logging': {
            'level': 'INFO',
            'max_log_size_mb': 10
        }
    }
    
    def __init__(self, config_path='./config/app_config.json'):
        self.config_path = Path(config_path)
        self.config = self.load_config()
    
    def load_config(self):
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    user_config = json.load(f)
                    return self._merge_configs(self.DEFAULT_CONFIG, user_config)
            except Exception as e:
                logger.error(f"Error loading config: {e}")
                return self.DEFAULT_CONFIG.copy()
        else:
            self.save_config(self.DEFAULT_CONFIG)
            return self.DEFAULT_CONFIG.copy()
    
    def save_config(self, config=None):
        if config is None:
            config = self.config
        
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=4)
            logger.info(f"Configuration saved to {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
    
    def _merge_configs(self, default, user):
        merged = default.copy()
        for key, value in user.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = self._merge_configs(merged[key], value)
            else:
                merged[key] = value
        return merged
    
    def get(self, key, default=None):
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default
        return value
    
    def set(self, key, value):
        keys = key.split('.')
        target = self.config
        for k in keys[:-1]:
            if k not in target:
                target[k] = {}
            target = target[k]
        target[keys[-1]] = value
        self.save_config()
    
    def get_config_dict(self):
        return self.config.copy()

def load_configuration():
    return Config()