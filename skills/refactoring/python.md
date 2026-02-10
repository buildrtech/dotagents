# Python

## Dead Code

```bash
rg "^def \w+|^class \w+" --type py -o | sort | uniq
rg "^#.*\n#.*\n#" --multiline --type py  # commented blocks
```

## Types

```bash
# Any violations
rg ": Any\b|-> Any\b" --type py
rg "Dict\[str, Any\]|dict\[str, Any\]" --type py
rg "# type: ignore" --type py
rg "cast\(" --type py  # type casts

# Weak patterns
rg "Optional\[" --type py  # prefer X | None (3.10+)
rg "Union\[" --type py  # prefer X | Y (3.10+)
rg "List\[|Dict\[|Set\[|Tuple\[" --type py  # prefer lowercase (3.9+)

# Boolean parameters (boolean blindness)
rg "def \w+\([^)]*: bool" --type py
rg "\w+\(True\)|\w+\(False\)" --type py  # boolean literals at call sites
```

## Tests

```bash
rg "@pytest.mark.skip|@unittest.skip" --type py
rg "(assert|self\.assert)" --type py -c | sort -t: -k2 -n
```

## Idiomatic Python

### Dataclasses Over Manual Classes

```python
# Manual __init__ with boilerplate:
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email

# Dataclass - concise, typed, with __eq__ and __repr__:
@dataclass
class User:
    name: str
    email: str

# Immutable and memory-efficient (3.10+):
@dataclass(frozen=True, slots=True)
class Config:
    host: str
    port: int = 8080

# Mutable defaults require field():
@dataclass
class Container:
    items: list[str] = field(default_factory=list)
```

### Comprehensions and Generators

```python
# List comprehension over loop:
result = []
for x in items:
    if x.valid:
        result.append(x.value)
# →
result = [x.value for x in items if x.valid]

# Dict comprehension:
d = {k: v for k, v in pairs if v is not None}

# Set comprehension:
unique_ids = {x.id for x in items}

# Generator for iteration (memory efficient):
for x in (item.value for item in items):
    process(x)

# Generator for single-pass, list for multiple passes
```

### Pattern Matching (3.10+)

```python
# Replace isinstance chains:
if isinstance(shape, Circle):
    area = math.pi * shape.radius ** 2
elif isinstance(shape, Square):
    area = shape.side ** 2
# →
match shape:
    case Circle(radius=r):
        area = math.pi * r ** 2
    case Square(side=s):
        area = s ** 2
    case _:
        raise ValueError(f"Unknown shape: {shape}")

# With guards:
match command:
    case ["move", x, y] if x > 0 and y > 0:
        move_to(x, y)
    case ["quit"]:
        exit()
    case _:
        print("Unknown command")
```

### Context Managers

```python
# Manual resource cleanup:
f = open(path)
try:
    data = f.read()
finally:
    f.close()
# →
with open(path) as f:
    data = f.read()

# Custom context manager with decorator:
from contextlib import contextmanager

@contextmanager
def timer(name: str):
    start = time.time()
    yield
    print(f"{name}: {time.time() - start:.2f}s")

with timer("processing"):
    process_data()

# Multiple contexts:
with open("in.txt") as f_in, open("out.txt", "w") as f_out:
    f_out.write(f_in.read())
```

### Modern Type Hints (3.10+)

```python
# Use X | Y instead of Union:
def process(value: int | str) -> None: ...

# Use X | None instead of Optional:
def find(id: int) -> User | None: ...

# Use lowercase built-in generics:
def get_items() -> list[str]: ...
def get_mapping() -> dict[str, int]: ...

# Protocol for structural typing:
from typing import Protocol

class Comparable(Protocol):
    def __lt__(self, other: Self) -> bool: ...

def sort_items[T: Comparable](items: list[T]) -> list[T]:
    return sorted(items)
```

### Pythonic Patterns

```python
# EAFP over LBYL:
if key in d:
    value = d[key]
# →
try:
    value = d[key]
except KeyError:
    value = default

# any/all over loops:
found = False
for x in items:
    if x.valid:
        found = True
        break
# →
found = any(x.valid for x in items)
all_valid = all(x.valid for x in items)

# enumerate over range(len()):
for i in range(len(items)):
    print(i, items[i])
# →
for i, item in enumerate(items):
    print(i, item)

# zip for parallel iteration:
for name, age in zip(names, ages):
    print(f"{name}: {age}")

# Walrus operator (3.8+):
if (match := pattern.search(text)):
    process(match)

# Dictionary get with default:
value = d[key] if key in d else default
# →
value = d.get(key, default)

# f-strings over format:
"Hello, {}".format(name)
# →
f"Hello, {name}"

# Unpacking:
first, *rest = items
head, *middle, tail = items
```

### Avoiding Common Mistakes

```python
# Mutable default argument (bug):
def append_to(item, items=[]):  # DON'T - shared list
    items.append(item)
    return items
# →
def append_to(item, items: list | None = None):
    if items is None:
        items = []
    items.append(item)
    return items

# Late binding in closures (bug):
funcs = [lambda: i for i in range(3)]
# All return 2!
# →
funcs = [lambda i=i: i for i in range(3)]

# Use is for None/True/False:
if x == None:  # DON'T
# →
if x is None:  # correct
```

### Boolean Blindness

```python
# Boolean parameter hides intent:
def send_email(user: User, urgent: bool) -> None: ...
send_email(user, True)  # what does True mean? →

# Use Enum for self-documenting call sites:
from enum import Enum, auto

class Priority(Enum):
    NORMAL = auto()
    URGENT = auto()

def send_email(user: User, priority: Priority = Priority.NORMAL) -> None: ...
send_email(user, Priority.URGENT)  # clear intent

# Or use Literal for simple cases:
from typing import Literal

Priority = Literal["normal", "urgent"]

def send_email(user: User, priority: Priority = "normal") -> None: ...
send_email(user, "urgent")
```

### Parse, Don't Validate

```python
# Validating then using raw dict:
def process(data: dict[str, Any]) -> None:
    if not isinstance(data.get("email"), str):
        raise ValueError("invalid email")
    # data["email"] is still Any... →

# Parse into dataclass at boundary:
@dataclass(frozen=True, slots=True)
class UserInput:
    email: str
    age: int

    @classmethod
    def parse(cls, data: dict[str, Any]) -> "UserInput":
        email = data.get("email")
        age = data.get("age")
        if not isinstance(email, str) or "@" not in email:
            raise ValueError("invalid email")
        if not isinstance(age, int) or age <= 0:
            raise ValueError("invalid age")
        return cls(email=email, age=age)

def process(user: UserInput) -> None:
    # user.email is str, user.age is int - guaranteed

# Or use pydantic for declarative parsing:
from pydantic import BaseModel, EmailStr, PositiveInt

class UserInput(BaseModel):
    email: EmailStr
    age: PositiveInt

user = UserInput.model_validate(data)  # raises if invalid
```

### Immutability

```python
# Prefer frozen dataclasses:
@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float

point = Point(1.0, 2.0)
point.x = 10.0  # raises FrozenInstanceError

# Use replace() for updates (returns new instance):
from dataclasses import replace
moved = replace(point, x=10.0)  # point unchanged

# For collections, prefer tuple over list when immutable:
ALLOWED_STATUSES: tuple[str, ...] = ("pending", "active", "closed")
```
