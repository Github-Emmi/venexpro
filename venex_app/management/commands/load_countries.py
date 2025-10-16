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
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)  # Skip header
                count = 0
                for row in reader:
                    if not row or len(row) < 2:
                        continue
                    name = row[1].strip()
                    Country.objects.get_or_create(name=name)
                    count += 1
                self.stdout.write(self.style.SUCCESS(f"{count} countries loaded successfully."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error loading countries: {e}"))
