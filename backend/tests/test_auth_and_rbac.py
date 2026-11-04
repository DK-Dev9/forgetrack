import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Organization
from apps.users.models import User, UserRole
from apps.products.models import Product, BillOfMaterials, BOMStatus
from apps.production.models import ProductionOrder, OrderStatus
from apps.inventory.models import UnitOfMeasure

@pytest.fixture
def org_a(db):
    return Organization.objects.create(name="Company A", slug="comp-a")

@pytest.fixture
def org_b(db):
    return Organization.objects.create(name="Company B", slug="comp-b")

@pytest.fixture
def admin_a(db, org_a):
    return User.objects.create_user(
        email="admin_a@example.com",
        password="Password123!",
        full_name="Admin A",
        role=UserRole.ADMIN,
        organization=org_a
    )

@pytest.fixture
def manager_a(db, org_a):
    return User.objects.create_user(
        email="manager_a@example.com",
        password="Password123!",
        full_name="Manager A",
        role=UserRole.PRODUCTION_MANAGER,
        organization=org_a
    )

@pytest.fixture
def storekeeper_a(db, org_a):
    return User.objects.create_user(
        email="store_a@example.com",
        password="Password123!",
        full_name="Storekeeper A",
        role=UserRole.STOREKEEPER,
        organization=org_a
    )

@pytest.fixture
def op1_a(db, org_a):
    return User.objects.create_user(
        email="op1_a@example.com",
        password="Password123!",
        full_name="Operator 1",
        role=UserRole.OPERATOR,
        organization=org_a
    )

@pytest.fixture
def op2_a(db, org_a):
    return User.objects.create_user(
        email="op2_a@example.com",
        password="Password123!",
        full_name="Operator 2",
        role=UserRole.OPERATOR,
        organization=org_a
    )

@pytest.fixture
def viewer_a(db, org_a):
    return User.objects.create_user(
        email="viewer_a@example.com",
        password="Password123!",
        full_name="Viewer A",
        role=UserRole.VIEWER,
        organization=org_a
    )

@pytest.fixture
def sample_orders(db, org_a, org_b, op1_a, op2_a, manager_a):
    uom_a = UnitOfMeasure.objects.create(organization=org_a, code="pcs", name="Piece")
    prod_a = Product.objects.create(organization=org_a, code="PA", name="Product A", unit_of_measure=uom_a)
    
    order1 = ProductionOrder.objects.create(
        organization=org_a,
        order_number="PO-A-1",
        product=prod_a,
        planned_quantity=Decimal('10.0000'),
        creator=manager_a
    )
    # Assign only op1 to order1
    from apps.production.services import ProductionService
    ProductionService.assign_user(order1, op1_a, actor=manager_a, is_primary=True)

    order2 = ProductionOrder.objects.create(
        organization=org_a,
        order_number="PO-A-2",
        product=prod_a,
        planned_quantity=Decimal('20.0000'),
        creator=manager_a
    )
    # Assign only op2 to order2
    ProductionService.assign_user(order2, op2_a, actor=manager_a, is_primary=True)

    # Order in Org B
    uom_b = UnitOfMeasure.objects.create(organization=org_b, code="pcs", name="Piece")
    prod_b = Product.objects.create(organization=org_b, code="PB", name="Product B", unit_of_measure=uom_b)
    order_b = ProductionOrder.objects.create(
        organization=org_b,
        order_number="PO-B-1",
        product=prod_b,
        planned_quantity=Decimal('5.0000')
    )

    return order1, order2, order_b


@pytest.mark.django_db
class TestAuthAndRBAC:

    def test_unauthenticated_request_blocked(self):
        client = APIClient()
        url = reverse('user-list-create')
        res = client.get(url)
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_deactivated_user_cannot_login(self, op1_a):
        op1_a.is_active = False
        op1_a.save()

        client = APIClient()
        res = client.post(reverse('auth-login'), {
            "email": op1_a.email,
            "password": "Password123!"
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "deactivated" in str(res.data)

    def test_admin_can_manage_users(self, admin_a):
        client = APIClient()
        client.force_authenticate(user=admin_a)

        # List users
        res = client.get(reverse('user-list-create'))
        assert res.status_code == status.HTTP_200_OK

        # Create user
        create_res = client.post(reverse('user-list-create'), {
            "email": "newbie@example.com",
            "full_name": "New User",
            "role": UserRole.OPERATOR,
            "password": "Password123!"
        })
        assert create_res.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(email="newbie@example.com", organization=admin_a.organization).exists()

    def test_non_admin_cannot_manage_users(self, manager_a, storekeeper_a, op1_a):
        for user in [manager_a, storekeeper_a, op1_a]:
            client = APIClient()
            client.force_authenticate(user=user)
            res = client.get(reverse('user-list-create'))
            assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_operator_only_sees_assigned_orders(self, op1_a, sample_orders):
        order1, order2, order_b = sample_orders
        client = APIClient()
        client.force_authenticate(user=op1_a)

        # List orders
        res = client.get(reverse('production-order-list-create'))
        assert res.status_code == status.HTTP_200_OK
        
        # op1 is only assigned to order1
        results = res.data.get('results', res.data)
        order_numbers = [o['order_number'] for o in results]
        assert "PO-A-1" in order_numbers
        assert "PO-A-2" not in order_numbers
        assert "PO-B-1" not in order_numbers

    def test_operator_cannot_access_unassigned_order_detail(self, op1_a, sample_orders):
        order1, order2, order_b = sample_orders
        client = APIClient()
        client.force_authenticate(user=op1_a)

        # Attempt to access order 2
        res = client.get(reverse('production-order-detail', kwargs={'id': order2.id}))
        assert res.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_cross_organization_access_rejected(self, admin_a, sample_orders):
        order1, order2, order_b = sample_orders
        client = APIClient()
        client.force_authenticate(user=admin_a)

        # Attempt to access order belonging to Org B
        res = client.get(reverse('production-order-detail', kwargs={'id': order_b.id}))
        assert res.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_costing_reports_restricted(self, storekeeper_a, op1_a, manager_a, admin_a):
        url = reverse('report-production-costs')

        for restricted_user in [storekeeper_a, op1_a]:
            client = APIClient()
            client.force_authenticate(user=restricted_user)
            res = client.get(url)
            assert res.status_code == status.HTTP_403_FORBIDDEN

        for allowed_user in [manager_a, admin_a]:
            client = APIClient()
            client.force_authenticate(user=allowed_user)
            res = client.get(url)
            assert res.status_code == status.HTTP_200_OK
