## mr-next-ddd

A real-world `DDD` implementation project comprises the same phases as any other software development project. These phases include:

Refine and refactor the domain model based on the design and development `(Continuous Integration (CI) of model concepts)`.
Repeat the above steps using the updated domain model `(CI of domain implementation)`.
An agile software development methodology is a great fit here because agile methodologies focus on the delivery of business value just like DDD focuses on the alignment of software system with business model. Also, using SCRUM `(for project management)` and XP `(for software development purposes)` methodologies is a good combination for managing a DDD implementation project.

# Folder structures:

```
root
├─ src
│ ├─ constants
│ │ └─ endpoints.ts
│ ├─ modules
│   └─ user
│      ├─ domains
│      │ ├─ models
│      │ │  └─ User.ts
│      │ └─ IUserService.ts
│      ├─ user.presentation.ts
│      └─ user.service.ts
|---------


```

# Domain Layer

The domain layer contains the business logic of the application.
It includes the domain model `(models)` and the `service` interface . <br/>
The `domain model` encapsulates the business rules and the `service` interface defines the contract for interacting with the data source.

```
├─ domains
│ ├─ models
│ │  └─ User.ts
│ └─ IUserService.ts
```

- user/domains/models/User.ts

```ts
export interface User {
  email: string;
  username: string;
  bio?: string;
  image?: string;
  token: string;
}
```

- user/domains/IUserService.ts

```ts
export interface IUserService {
  update(body: UserUpdateParams): Promise<ResponseObject<UserUpdate>>;
  findByToken(): Promise<ResponseObject<UserCurrent>>;
  findByEmailAndPassword(
    body: UserLoginParams,
  ): Promise<ResponseObject<UserCurrent>>;
  create(body: UserCreateParams): Promise<ResponseObject<UserCreate>>;
}
```

# Application Layer

The application layer contains the application services `(services)` and the data transfer objects `(dtos)`.<br/>
The application services encapsulate the `use-cases` of the application and the data transfer objects shape the data for the client-side.


```
└─ user
  ├─ ...
  ├─ User.service.ts
```

- user/User.service.ts

```ts
function UserService(): IUserService {
  return {
    findByToken: () =>
      serviceHandler(() =>
        request.get(endpoints.USERS.GET_USER()),
      ),

    findByEmailAndPassword: (body) =>
      serviceHandler(() =>
        requestWithoutAuth.post(endpoints.USERS.POST_USERS_LOGIN(), body),
      ),
    update: (body) =>
      serviceHandler(() =>
        request.put(endpoints.USERS.PUT_USER(), body),
      ),

    create: (body) =>
      serviceHandler(() =>
        requestWithoutAuth.post(endpoints.USERS.POST_USERS(), body),
      ),
  };
}
```

# Presentation Layer

The presentation layer contains the controllers `(presentation)` and the query library `(reactQuery, SWR, ...)`. <br/>
The controllers handle the user interactions and delegate the work to the application layer. <br/>
`For example:` the `React Query` handles the state management and the data fetching for the React components.

```
└─ user
  ├─ ...
  ├─ User.presentation.ts

```

- user/User.presentation.ts

```ts
const userService = UserService();

export function UserPresentation() {
  return {
    useGetCurrentUser: () =>
      useQuery({
        queryKey: ['user'],
        queryFn: () => userService.getCurrentUser(),
      }),

    useUserLogin: () => {
      const router = useRouter();
      const searchParams = useSearchParams();
      return useMutation({
        mutationFn: () => {
          const rawFormData: UserLoginParams = {
            user: {
              email: '{{EMAIL}}',

              password: '{{PASSWORD}}',
            },
          };
          return userService.login(rawFormData);
        },
        onSuccess(response) {
          console.log('onSuccess :>> ', response);
          const nextUrl = searchParams.get('next');
          router.push(nextUrl ?? '/');
        },
        onError(error) {
          console.log('error :>> ', error);
        },
      });
    },
}
```