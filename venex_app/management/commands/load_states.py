import csv
from django.core.management import BaseCommand
from venex_app.models import State


class Command(BaseCommand):
    help = "Load states from a CSV file into the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path", type=str, required=True, help="Path to the CSV file"
        )

    def handle(self, *args, **kwargs):
        path = kwargs["path"]
        try:
            with open(path, "rt", encoding="utf-8") as f:
                reader = csv.reader(f, dialect="excel")
                states = []
                for row in reader:
                    # Validate the data
                    if not row[0].isdigit() or not row[2].isdigit():
                        self.stdout.write(
                            self.style.WARNING(f"Skipping invalid row: {row}")
                        )
                        continue
                    states.append(
                        State(
                            id=int(
                                row[0]
                            ),  # Optional: Remove if `id` is auto-generated
                            name=row[1].strip(),
                            country_id=int(row[2]),
                        )
                    )
                # Bulk insert for better performance
                State.objects.bulk_create(states, batch_size=100)
                self.stdout.write(
                    self.style.SUCCESS(f"{len(states)} states loaded successfully.")
                )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error loading states: {e}"))
