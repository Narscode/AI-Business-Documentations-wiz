from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_BASE_URL: str = ""
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/kvp"
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    ENV: str = "development"

    # Claude model IDs supported by your custom gateway
    MODEL_HEAVY: str = "claude-3-5-sonnet-20241022"
    MODEL_LIGHT: str = "claude-3-5-haiku-20241022"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
