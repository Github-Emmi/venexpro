import csv
from django.core.management import BaseCommand
from venex_app.models import Country


class Command(BaseCommand):
    help = "Load countries from a CSV file into the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path", type=str, required=True, help="Path to the CSV file"
        )

    def handle(self, *args, **kwargs):
        path = kwargs["path"]
        try:
            with open(path, "rt", encoding="utf-8") as f:
                reader = csv.reader(f, dialect="excel")
                countries = []
                for row in reader:
                    # Validate the data
                    if not row[0].isdigit():
                        self.stdout.write(
                            self.style.WARNING(f"Skipping invalid row: {row}")
                        )
                        continue
                    countries.append(Country(id=int(row[0]), name=row[1].strip()))
                # Bulk insert for better performance
                Country.objects.bulk_create(countries, batch_size=100)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{len(countries)} countries loaded successfully."
                    )
                )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error loading countries: {e}"))
