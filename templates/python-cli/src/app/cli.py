import click


@click.group()
@click.version_option()
def main():
    """{{PROJECT_NAME}} — replace this with your tool description."""


@main.command()
@click.argument("name", default="world")
def hello(name: str):
    """Greet NAME."""
    click.echo(f"Hello, {name}!")
