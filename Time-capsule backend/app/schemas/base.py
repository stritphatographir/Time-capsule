from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
   #Base schema.
    #- JSON field names use camelCase (openAt, createdAt, recipientCount),
 #     as in capsules.json and the frontend.
  #  - Python code uses snake_case (open_at, created_at).
 #   - Leading and trailing whitespace in strings is automatically trimmed
  #    (like .trim() in create.js).

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
    )
