import os

# O engine é criado no import de app.core.db: o banco de teste precisa ser definido antes.
os.environ["LOGOS_DATABASE_URL"] = os.environ.get(
    "LOGOS_TEST_DATABASE_URL", "postgresql+psycopg://logos:logos@localhost:5432/logos_test"
)
os.environ["LOGOS_ENVIRONMENT"] = "test"
# O listener de tempo real é testado à parte; os testes de API não precisam dele.
os.environ["LOGOS_REALTIME_ENABLED"] = "false"
