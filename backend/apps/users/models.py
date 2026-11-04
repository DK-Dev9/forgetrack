import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from apps.organizations.models import Organization

class UserRole(models.TextChoices):
    ADMIN = 'ADMIN', 'Administrator'
    PRODUCTION_MANAGER = 'PRODUCTION_MANAGER', 'Production Manager'
    STOREKEEPER = 'STOREKEEPER', 'Storekeeper'
    OPERATOR = 'OPERATOR', 'Production Operator'
    VIEWER = 'VIEWER', 'Viewer'


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email address is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='users',
        null=True,
        blank=True
    )
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.OPERATOR
    )
    employee_code = models.CharField(max_length=50, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'users'
        ordering = ['full_name']

    def __str__(self):
        return f"{self.full_name} ({self.email}) - {self.role}"

    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    @property
    def is_production_manager(self):
        return self.role == UserRole.PRODUCTION_MANAGER

    @property
    def is_storekeeper(self):
        return self.role == UserRole.STOREKEEPER

    @property
    def is_operator(self):
        return self.role == UserRole.OPERATOR

    @property
    def is_viewer(self):
        return self.role == UserRole.VIEWER
