from typing import Optional, List, Literal
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field, model_validator, field_validator

Category = Literal["Electronics","Fashion", "Home"] 
Role = Literal["buyer", "seller"]

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6)
    role: Role = "buyer"
    email: EmailStr
    date_of_birth: Optional[date] = None

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 bytes")
        return v

class UserLogin(BaseModel):
    password: str
    email: str

class UserOut(BaseModel):
    id: str
    name: str
    email:EmailStr
    role: Role = "buyer"

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer" 
    user: UserOut   

class TokenData(BaseModel):
    email: Optional[str] = None


class CartAdd(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=99)

class CartItem(BaseModel):
    product_id: str
    name: str
    price: float
    image: str
    quantity: int

class CartOut(BaseModel):
    items: List[CartItem]
    total: float
    count: int

class RecentOrder(BaseModel):
    id: str
    date: str
    status: str
    total: float

class DashboardStats(BaseModel):
    user: UserOut
    cart_count: int
    cart_total: float
    orders_placed: int
    total_spent: float
    wishlist: int
    recent_orders: List[RecentOrder]
    sales_last_7_days: List[float]

class Product(BaseModel):
    """what the api sends back for a product """

    id: str
    name: str
    category: str
    price: float
    old_price: Optional[float] = None
    rating: float = 0
    image: str
    badge: Optional[str]
    stock: int = 0
    description: str = ""
    seller_id: Optional[str] = None

class ProductCreate(BaseModel):
    """what the seller sends to create a product"""

    name:str = Field(min_length=2, max_length=120)
    category: Category
    price: float = Field(gt=0, le=1_000_000)
    old_price: Optional[float] = Field(default=None, gt=0, le=1_000_000)
    stock: int = Field(default=0, ge=0, le=100_000)
    image: str = Field(default="", max_length=500)
    badge: Optional[str] = Field(default=None, max_length=20)
    description: str = Field(default="", max_length=2000)
    
    @model_validator(mode="after")
    def old_price_above_price(self):
        if self.old_price is not None and self.old_price <= self.price:
            raise ValueError("old_price must be higher than price")
        return self

class ProductUpdate(BaseModel):
    """PATCH body: every field optional, only the ones sent are changed"""

    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    category: Optional[Category] = None
    price: Optional[float] = Field(default=None, gt=0, le=1_000_000)
    old_price: Optional[float] = Field(default=None, gt=0, le=1_000_000)
    stock: Optional[int] = Field(default=None, ge=0, le=100_000)
    image: Optional[str] = Field(default=None, max_length=500)
    badge: Optional[str] = Field(default=None, max_length=20)
    description: Optional[str] = Field(default=None, max_length=2000)

class CreateOrderOut(BaseModel):
    order_id: str
    razorpay_order_id: str
    amount: int
    currency: str
    key_id: str

class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)

class DeliveryAddress(BaseModel):
    full_name: str = Field(min_length=2)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    address_line: str = Field(min_length=5)
    city: str = Field(min_length=2)
    state: str = Field(min_length=2)
    pincode: str = Field(pattern=r"^\d{6}$")

class OrderOut(BaseModel):
    id: str
    status: Literal["created", "paid", "refunded", "needs_review"]
    amount: int
    currency: str
    items: List[CartItem]
    delivery_address: Optional[DeliveryAddress] = None
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    created_at: datetime
    paid_at: Optional[datetime] = None
    note: Optional[str] = None


class CreateOrderIn(BaseModel):
    address: DeliveryAddress