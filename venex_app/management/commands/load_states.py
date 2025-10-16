import csv
from django.core.management import BaseCommand
from venex_app.models import State, Country

class Command(BaseCommand):
    help = "Load states from a CSV file into the database"

    def add_arguments(self, parser):
        parser.add_argument("--path", type=str, required=True, help="Path to the CSV file")

    def handle(self, *args, **kwargs):
        path = kwargs["path"]
        try:
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)  # Skip header
                count = 0
                for row in reader:
                    if not row or len(row) < 3:
                        continue
                    name = row[1].strip()
                    country_id = row[2]
                    try:
                        country = Country.objects.get(id=country_id)
                        State.objects.get_or_create(name=name, country=country)
                        count += 1
                    except Country.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f"Country {country_id} not found for {name}"))
                self.stdout.write(self.style.SUCCESS(f"{count} states loaded successfully."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error loading states: {e}"))
